// services/frontend/src/components/Admin/shared/StatusBadge.jsx
import React from 'react';

/**
 * Badge de statut réutilisable
 */
export const StatusBadge = ({ status, customLabels = {}, customColors = {} }) => {
  const defaultLabels = {
    active: 'Actif',
    inactive: 'Inactif',
    suspended: 'Suspendu',
    pending: 'En attente',
    expired: 'Expiré',
    valid: 'Valide',
    revoked: 'Révoqué',
    warning: 'Attention',
    error: 'Erreur',
    success: 'Succès'
  };

  const defaultColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    suspended: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    expired: 'bg-red-100 text-red-800',
    valid: 'bg-green-100 text-green-800',
    revoked: 'bg-gray-100 text-gray-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    success: 'bg-green-100 text-green-800'
  };

  const labels = { ...defaultLabels, ...customLabels };
  const colors = { ...defaultColors, ...customColors };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
};

export default StatusBadge;