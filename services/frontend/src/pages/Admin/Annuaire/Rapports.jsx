// services/frontend/src/pages/Admin/Annuaire/Rapports.jsx
import React, { useState, useEffect } from 'react';

const Rapports = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetails, setReportDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 20 });

  useEffect(() => {
    loadReports();
  }, [pagination.page]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/annuaire/indicators/reports?page=${pagination.page}&limit=${pagination.limit}`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );
      const data = await response.json();

      setReports(data.reports || []);
      setPagination(prev => ({ ...prev, total: data.total || 0 }));
    } catch (error) {
      console.error('Erreur chargement rapports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReportDetails = async (reportId) => {
    setLoadingDetails(true);
    setSelectedReport(reportId);
    try {
      const response = await fetch(
        `/api/v1/annuaire/indicators/reports/${reportId}`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );
      const data = await response.json();
      setReportDetails(data);
    } catch (error) {
      console.error('Erreur chargement détails:', error);
    } finally {
      setLoadingDetails(false);
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
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Comptes Rendus d'Alimentation Annuaire
        </h2>
        <p className="text-gray-500 text-sm">
          Les comptes rendus sont récupérés automatiquement chaque jour depuis l'ANS.
          Ils contiennent le résultat des opérations de publication dans l'annuaire national.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des rapports */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-medium text-gray-900">Rapports récents</h3>
            </div>

            {reports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun rapport disponible
              </div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => loadReportDetails(report.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                      selectedReport === report.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {new Date(report.date).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {report.total_operations} opération(s)
                        </p>
                      </div>
                      <ReportStatusBadge 
                        success={report.success_count} 
                        errors={report.error_count} 
                      />
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        ✓ {report.success_count}
                      </span>
                      {report.error_count > 0 && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                          ✗ {report.error_count}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="p-4 border-t bg-gray-50 flex justify-between">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="text-sm text-blue-600 disabled:text-gray-400"
                >
                  ← Précédent
                </button>
                <span className="text-sm text-gray-500">
                  {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
                </span>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page * pagination.limit >= pagination.total}
                  className="text-sm text-blue-600 disabled:text-gray-400"
                >
                  Suivant →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Détails du rapport */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {!selectedReport ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="text-center">
                  <span className="text-5xl mb-4 block">📋</span>
                  <p>Sélectionnez un rapport pour voir les détails</p>
                </div>
              </div>
            ) : loadingDetails ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : reportDetails ? (
              <>
                <div className="p-6 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Rapport du {new Date(reportDetails.date).toLocaleDateString('fr-FR')}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Récupéré le {new Date(reportDetails.retrieved_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{reportDetails.success_count}</p>
                        <p className="text-gray-500">Succès</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{reportDetails.error_count}</p>
                        <p className="text-gray-500">Erreurs</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Erreurs détaillées */}
                {reportDetails.errors && reportDetails.errors.length > 0 && (
                  <div className="p-6 border-b">
                    <h4 className="font-medium text-red-800 mb-4">
                      ⚠️ Erreurs détectées ({reportDetails.errors.length})
                    </h4>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {reportDetails.errors.map((error, index) => (
                        <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-red-900">{error.email}</p>
                              <p className="text-sm text-red-700 mt-1">{error.message}</p>
                              {error.code && (
                                <p className="text-xs text-red-500 mt-1">Code: {error.code}</p>
                              )}
                            </div>
                            <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">
                              {error.operation}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Opérations réussies */}
                {reportDetails.successes && reportDetails.successes.length > 0 && (
                  <div className="p-6">
                    <h4 className="font-medium text-green-800 mb-4">
                      ✓ Opérations réussies ({reportDetails.successes.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {reportDetails.successes.map((success, index) => (
                        <div key={index} className="flex items-center justify-between py-2 px-3 bg-green-50 rounded">
                          <span className="text-sm text-green-900">{success.email}</span>
                          <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                            {success.operation}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Résumé par opération */}
                {reportDetails.summary && (
                  <div className="p-6 border-t bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3">Résumé par type d'opération</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-blue-600">
                          {reportDetails.summary.created || 0}
                        </p>
                        <p className="text-xs text-gray-500">Créations</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-purple-600">
                          {reportDetails.summary.updated || 0}
                        </p>
                        <p className="text-xs text-gray-500">Mises à jour</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-red-600">
                          {reportDetails.summary.deleted || 0}
                        </p>
                        <p className="text-xs text-gray-500">Suppressions</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const ReportStatusBadge = ({ success, errors }) => {
  if (errors === 0) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        ✓ OK
      </span>
    );
  }
  if (success === 0) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        ✗ Échec
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
      ⚠️ Partiel
    </span>
  );
};

export default Rapports;