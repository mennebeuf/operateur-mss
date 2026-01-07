// services/frontend/src/components/Common/ProtectedRoute.jsx
/**
 * Composant de protection des routes authentifiées
 * Redirige vers la page de login si l'utilisateur n'est pas connecté
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';

import Loader from './Loader';

const ProtectedRoute = ({ children, requiredPermissions = [] }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Afficher un loader pendant la vérification de l'authentification
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader size="lg" message="Vérification de l'authentification..." />
      </div>
    );
  }

  // Rediriger vers login si non authentifié
  if (!isAuthenticated) {
    // Sauvegarder l'URL de destination pour redirection après login
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Vérifier les permissions si spécifiées
  if (requiredPermissions.length > 0) {
    const userPermissions = user?.permissions || [];
    const hasAllPermissions = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
