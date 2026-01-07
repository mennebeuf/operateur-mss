// services/frontend/src/components/Common/AdminRoute.jsx
/**
 * Composant de protection des routes d'administration
 * Vérifie que l'utilisateur est Super Admin ou Domain Admin
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';

import Loader from './Loader';

const AdminRoute = ({ children, requireSuperAdmin = false }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Afficher un loader pendant la vérification
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader size="lg" message="Vérification des droits..." />
      </div>
    );
  }

  // Rediriger vers login si non authentifié
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Vérifier les droits d'administration
  const isSuperAdmin = user?.is_super_admin || user?.role === 'super_admin';
  const isDomainAdmin = user?.role === 'domain_admin';
  const isAdmin = isSuperAdmin || isDomainAdmin;

  // Si super admin requis et l'utilisateur ne l'est pas
  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès restreint</h1>
          <p className="text-gray-600 mb-6">
            Cette section est réservée aux Super Administrateurs.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas admin du tout
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-6xl mb-4">⛔</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès non autorisé</h1>
          <p className="text-gray-600 mb-6">
            Vous n'avez pas les droits nécessaires pour accéder à cette section.
          </p>
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default AdminRoute;
