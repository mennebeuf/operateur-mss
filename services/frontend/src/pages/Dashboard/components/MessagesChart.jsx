// services/frontend/src/pages/Dashboard/components/MessagesChart.jsx

import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import axios from 'axios';
import { useDomain } from '../../../contexts/DomainContext';

const API_BASE = '/api/v1';

const MessagesChart = ({ domainId, data: initialData }) => {
  const { getHeaders } = useDomain();
  const [data, setData] = useState(initialData || []);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData?.length > 0) {
      setData(initialData);
    }
  }, [initialData]);

  const loadChartData = async (newPeriod) => {
    if (!domainId) return;
    
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE}/domains/${domainId}/messages/stats`,
        {
          headers: getHeaders(),
          params: { period: newPeriod }
        }
      );
      setData(response.data.data || response.data || []);
    } catch (error) {
      console.error('Erreur chargement stats messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    loadChartData(newPeriod);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Activité email</h3>
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1 text-sm rounded-lg transition ${
                period === p 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              disabled={loading}
            >
              {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : '90 jours'}
            </button>
          ))}
        </div>
      </div>
      
      {loading ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          Chargement...
        </div>
      ) : data.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              labelFormatter={(label) => `Date: ${formatDate(label)}`}
              contentStyle={{ borderRadius: '8px' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="sent" 
              name="Envoyés"
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="received" 
              name="Reçus"
              stroke="#10b981" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-400">
          Aucune donnée disponible
        </div>
      )}
    </div>
  );
};

export default MessagesChart;