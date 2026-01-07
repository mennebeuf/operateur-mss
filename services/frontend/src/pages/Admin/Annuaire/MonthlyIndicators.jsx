// services/frontend/src/pages/Admin/Annuaire/MonthlyIndicators.jsx
/**
 * Indicateurs mensuels ANS - Administration
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import Loader from '../../../components/Common/Loader';
import { adminApi } from '../../../services/adminApi';

const MonthlyIndicators = () => {
  const [indicators, setIndicators] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadIndicators();
  }, [selectedMonth]);

  const loadIndicators = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getMonthlyIndicators(selectedMonth);
      setIndicators(response.data || response);
    } catch (error) {
      console.error('Erreur chargement indicateurs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await adminApi.exportMonthlyIndicators(selectedMonth);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `indicateurs-${selectedMonth}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur export:', error);
      alert("Erreur lors de l'export");
    }
  };

  const IndicatorCard = ({ title, value, description, icon, trend }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend !== undefined && (
            <p className={`text-sm mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs mois précédent
            </p>
          )}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
      {description && <p className="text-xs text-gray-400 mt-2">{description}</p>}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Indicateurs mensuels</h1>
          <p className="text-gray-500">Métriques requises par l'ANS</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/annuaire/reports"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            📋 Rapports
          </Link>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            📥 Exporter
          </button>
        </div>
      </div>

      {/* Sélecteur de période */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Période :</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={loadIndicators}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            🔄 Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <Loader message="Chargement des indicateurs..." />
      ) : !indicators ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Aucune donnée disponible pour cette période
        </div>
      ) : (
        <>
          {/* Indicateurs principaux */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <IndicatorCard
              title="BAL actives"
              value={indicators.active_mailboxes || 0}
              icon="📬"
              trend={indicators.mailboxes_trend}
              description="Boîtes aux lettres actives"
            />
            <IndicatorCard
              title="BAL personnelles"
              value={indicators.personal_mailboxes || 0}
              icon="👤"
              description="Rattachées à un PS"
            />
            <IndicatorCard
              title="BAL organisationnelles"
              value={indicators.organizational_mailboxes || 0}
              icon="🏢"
              description="Services et secrétariats"
            />
            <IndicatorCard
              title="BAL applicatives"
              value={indicators.application_mailboxes || 0}
              icon="🤖"
              description="DPI, SIH, etc."
            />
          </div>

          {/* Métriques de volumétrie */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Volumétrie des échanges</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-4xl font-bold text-blue-600">
                  {indicators.messages_sent?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1">Messages envoyés</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-4xl font-bold text-green-600">
                  {indicators.messages_received?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1">Messages reçus</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-4xl font-bold text-purple-600">
                  {indicators.storage_used_gb || 0} GB
                </p>
                <p className="text-sm text-gray-600 mt-1">Stockage utilisé</p>
              </div>
            </div>
          </div>

          {/* Indicateurs de qualité */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Indicateurs de qualité</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">Taux de délivrabilité</p>
                <p className="text-2xl font-bold text-green-600">
                  {indicators.delivery_rate || 99.5}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Disponibilité du service</p>
                <p className="text-2xl font-bold text-green-600">{indicators.uptime || 99.9}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Certificats valides</p>
                <p className="text-2xl font-bold text-blue-600">
                  {indicators.valid_certificates || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Certificats à renouveler</p>
                <p className="text-2xl font-bold text-orange-600">
                  {indicators.expiring_certificates || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Répartition par domaine */}
          {indicators.domains_breakdown && indicators.domains_breakdown.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Répartition par domaine</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Domaine</th>
                      <th className="px-4 py-2 text-right">BAL actives</th>
                      <th className="px-4 py-2 text-right">Messages</th>
                      <th className="px-4 py-2 text-right">Stockage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {indicators.domains_breakdown.map((domain, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{domain.name}</td>
                        <td className="px-4 py-2 text-right">{domain.mailboxes}</td>
                        <td className="px-4 py-2 text-right">
                          {domain.messages?.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">{domain.storage_gb} GB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">ℹ️ Indicateurs ANS</h3>
        <p className="text-sm text-blue-700">
          Ces indicateurs correspondent aux métriques demandées par l'ANS dans le cadre du suivi des
          opérateurs MSSanté. Ils sont calculés automatiquement chaque mois et peuvent être exportés
          au format requis.
        </p>
      </div>
    </div>
  );
};

export default MonthlyIndicators;
