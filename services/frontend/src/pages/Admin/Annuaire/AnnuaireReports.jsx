// services/frontend/src/pages/Admin/Annuaire/AnnuaireReports.jsx
/**
 * Rapports Annuaire ANS - Administration
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import Loader from '../../../components/Common/Loader';
import { adminApi } from '../../../services/adminApi';

const AnnuaireReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getAnnuaireReports();
      setReports(response.data || []);
    } catch (error) {
      console.error('Erreur chargement rapports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await adminApi.generateAnnuaireReport(selectedMonth);
      await loadReports();
      alert('Rapport généré avec succès');
    } catch (error) {
      console.error('Erreur génération:', error);
      alert('Erreur lors de la génération du rapport');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId, format = 'csv') => {
    try {
      const blob = await adminApi.downloadAnnuaireReport(reportId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-annuaire-${reportId}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      alert('Erreur lors du téléchargement');
    }
  };

  const statusColors = {
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800'
  };

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports Annuaire ANS</h1>
          <p className="text-gray-500">Gestion des rapports mensuels pour l'Annuaire Santé</p>
        </div>
        <Link
          to="/admin/annuaire/indicators"
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          📊 Indicateurs mensuels
        </Link>
      </div>

      {/* Génération de rapport */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Générer un nouveau rapport</h2>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Période</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? '⏳ Génération...' : '📄 Générer le rapport'}
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Le rapport sera généré conformément aux exigences de l'Annuaire Santé de l'ANS.
        </p>
      </div>

      {/* Liste des rapports */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Historique des rapports</h2>
        </div>

        {loading ? (
          <div className="p-8">
            <Loader message="Chargement des rapports..." />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-4xl mb-4">📋</p>
            <p>Aucun rapport généré</p>
            <p className="text-sm">Générez votre premier rapport ci-dessus</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Période
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Généré le
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    BAL déclarées
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reports.map(report => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{report.period}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(report.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[report.status]}`}
                      >
                        {report.status === 'completed'
                          ? 'Terminé'
                          : report.status === 'pending'
                            ? 'En attente'
                            : report.status === 'processing'
                              ? 'En cours'
                              : 'Échec'}
                      </span>
                    </td>
                    <td className="px-6 py-4">{report.mailboxes_count || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      {report.status === 'completed' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleDownload(report.id, 'csv')}
                            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            📥 CSV
                          </button>
                          <button
                            onClick={() => handleDownload(report.id, 'xml')}
                            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            📥 XML
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">ℹ️ À propos des rapports Annuaire</h3>
        <p className="text-sm text-blue-700">
          Ces rapports contiennent les informations des boîtes aux lettres MSSanté à déclarer auprès
          de l'Annuaire Santé de l'ANS. Ils incluent les BAL personnelles et organisationnelles
          conformément aux exigences du référentiel MSSanté.
        </p>
      </div>
    </div>
  );
};

export default AnnuaireReports;
