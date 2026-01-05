// services/frontend/src/pages/Admin/Annuaire/Indicateurs.jsx
import React, { useState, useEffect } from 'react';

const Indicateurs = () => {
  const [indicators, setIndicators] = useState([]);
  const [currentIndicators, setCurrentIndicators] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  useEffect(() => {
    loadIndicators();
  }, []);

  const loadIndicators = async () => {
    setLoading(true);
    try {
      const [currentRes, historyRes] = await Promise.all([
        fetch('/api/v1/annuaire/indicators?period=month', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/v1/annuaire/indicators/reports?limit=12', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const [currentData, historyData] = await Promise.all([
        currentRes.json(),
        historyRes.json()
      ]);

      setCurrentIndicators(currentData);
      setIndicators(historyData.reports || []);
    } catch (error) {
      console.error('Erreur chargement indicateurs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (year, month) => {
    if (!confirm(`Soumettre les indicateurs de ${month}/${year} à l'ANS ?`)) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/annuaire/indicators/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ period: `${year}-${String(month).padStart(2, '0')}` })
      });

      if (response.ok) {
        alert('Indicateurs soumis avec succès');
        loadIndicators();
      } else {
        const data = await response.json();
        alert(`Erreur: ${data.error || 'Échec de la soumission'}`);
      }
    } catch (error) {
      console.error('Erreur soumission:', error);
      alert('Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCSV = async (year, month) => {
    try {
      const response = await fetch(
        `/api/v1/annuaire/indicators/export?year=${year}&month=${month}&format=csv`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `indicateurs_${year}_${String(month).padStart(2, '0')}.csv`;
      a.click();
    } catch (error) {
      console.error('Erreur téléchargement:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  return (
    <div className="space-y-6">
      {/* Indicateurs du mois en cours */}
      {currentIndicators && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Indicateurs {currentIndicators.month}/{currentIndicators.year}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {currentIndicators.submitted_at 
                  ? `Soumis le ${new Date(currentIndicators.submitted_at).toLocaleDateString('fr-FR')}`
                  : 'À soumettre avant le 10 du mois suivant'}
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => downloadCSV(currentIndicators.year, currentIndicators.month)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
              >
                📥 Exporter CSV
              </button>
              {!currentIndicators.submitted_at && (
                <button
                  onClick={() => handleSubmit(currentIndicators.year, currentIndicators.month)}
                  disabled={submitting}
                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Soumission...' : '📤 Soumettre à l\'ANS'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard
              label="BAL Personnelles"
              value={currentIndicators.bal_personal_count || 0}
              icon="👤"
            />
            <IndicatorCard
              label="BAL Organisationnelles"
              value={currentIndicators.bal_organizational_count || 0}
              icon="🏢"
            />
            <IndicatorCard
              label="BAL Applicatives"
              value={currentIndicators.bal_applicative_count || 0}
              icon="⚙️"
            />
            <IndicatorCard
              label="BAL Liste Rouge"
              value={currentIndicators.bal_liste_rouge_count || 0}
              icon="🔒"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <IndicatorCard
              label="BAL Créées"
              value={`+${currentIndicators.bal_created_count || 0}`}
              color="green"
              icon="➕"
            />
            <IndicatorCard
              label="BAL Supprimées"
              value={`-${currentIndicators.bal_deleted_count || 0}`}
              color="red"
              icon="➖"
            />
            <IndicatorCard
              label="Messages Envoyés"
              value={currentIndicators.messages_sent || 0}
              icon="📤"
            />
            <IndicatorCard
              label="Messages Reçus"
              value={currentIndicators.messages_received || 0}
              icon="📥"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <IndicatorCard
              label="Volume de données"
              value={formatBytes(currentIndicators.data_volume_mb * 1024 * 1024)}
              icon="💾"
            />
            <IndicatorCard
              label="Disponibilité"
              value={`${currentIndicators.uptime_percentage || 0}%`}
              color={currentIndicators.uptime_percentage >= 99 ? 'green' : 'yellow'}
              icon="📊"
            />
            <IndicatorCard
              label="Incidents"
              value={currentIndicators.incidents_count || 0}
              color={currentIndicators.incidents_count > 0 ? 'red' : 'green'}
              icon="⚠️"
            />
          </div>
        </div>
      )}

      {/* Historique des indicateurs */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Historique des indicateurs</h2>
        </div>

        {indicators.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Aucun historique d'indicateurs
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">BAL Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Messages</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disponibilité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {indicators.map((ind) => (
                <tr key={`${ind.year}-${ind.month}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">
                    {String(ind.month).padStart(2, '0')}/{ind.year}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {(ind.bal_personal_count || 0) + (ind.bal_organizational_count || 0) + (ind.bal_applicative_count || 0)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {(ind.messages_sent || 0) + (ind.messages_received || 0)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={ind.uptime_percentage >= 99 ? 'text-green-600' : 'text-yellow-600'}>
                      {ind.uptime_percentage || 0}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {ind.submitted_at ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Soumis le {new Date(ind.submitted_at).toLocaleDateString('fr-FR')}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⏳ En attente
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedPeriod(ind)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Détails
                      </button>
                      <button
                        onClick={() => downloadCSV(ind.year, ind.month)}
                        className="text-gray-600 hover:underline text-sm"
                      >
                        CSV
                      </button>
                      {!ind.submitted_at && (
                        <button
                          onClick={() => handleSubmit(ind.year, ind.month)}
                          disabled={submitting}
                          className="text-green-600 hover:underline text-sm font-medium"
                        >
                          Soumettre
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal détails */}
      {selectedPeriod && (
        <IndicatorDetailModal
          indicator={selectedPeriod}
          onClose={() => setSelectedPeriod(null)}
        />
      )}
    </div>
  );
};

const IndicatorCard = ({ label, value, icon, color = 'default' }) => {
  const colorClasses = {
    default: 'bg-gray-50',
    green: 'bg-green-50',
    red: 'bg-red-50',
    yellow: 'bg-yellow-50',
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
};

const IndicatorDetailModal = ({ indicator, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            Indicateurs {String(indicator.month).padStart(2, '0')}/{indicator.year}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="BAL Personnelles" value={indicator.bal_personal_count} />
            <DetailRow label="BAL Organisationnelles" value={indicator.bal_organizational_count} />
            <DetailRow label="BAL Applicatives" value={indicator.bal_applicative_count} />
            <DetailRow label="BAL Liste Rouge" value={indicator.bal_liste_rouge_count} />
            <DetailRow label="BAL Créées" value={`+${indicator.bal_created_count || 0}`} />
            <DetailRow label="BAL Supprimées" value={`-${indicator.bal_deleted_count || 0}`} />
            <DetailRow label="Messages Envoyés" value={indicator.messages_sent} />
            <DetailRow label="Messages Reçus" value={indicator.messages_received} />
            <DetailRow label="Volume Données" value={formatBytes(indicator.data_volume_mb * 1024 * 1024)} />
            <DetailRow label="Disponibilité" value={`${indicator.uptime_percentage}%`} />
            <DetailRow label="Incidents" value={indicator.incidents_count} />
            <DetailRow label="Généré le" value={new Date(indicator.generated_at).toLocaleString('fr-FR')} />
            {indicator.submitted_at && (
              <DetailRow label="Soumis le" value={new Date(indicator.submitted_at).toLocaleString('fr-FR')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    <p className="font-medium">{value ?? '-'}</p>
  </div>
);

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default Indicateurs;