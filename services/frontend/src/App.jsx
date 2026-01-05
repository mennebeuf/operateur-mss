/**
 * MSSanté Frontend - Composant Application Principal
 * services/frontend/src/App.jsx
 * 
 * Point d'entrée de l'application React
 * Gère le routing, les layouts et les états globaux
 */

import React, { Suspense, useEffect } from 'react';
import { useRoutes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Routes configuration
import routes from './routes';

// Hooks
import { useAuth } from './contexts/AuthContext';

// Components
import Loader from './components/Common/Loader';

/**
 * Composant de chargement global
 */
const GlobalLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <Loader size="lg" />
      <p className="mt-4 text-gray-600">Chargement de MSSanté...</p>
    </div>
  </div>
);

/**
 * Composant d'erreur global (Error Boundary Fallback)
 */
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
      <div className="text-red-500 text-5xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Une erreur est survenue
      </h1>
      <p className="text-gray-600 mb-4">
        {error?.message || 'Une erreur inattendue s\'est produite.'}
      </p>
      <div className="space-x-4">
        <button
          onClick={resetErrorBoundary}
          className="btn-primary"
        >
          Réessayer
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="btn-secondary"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  </div>
);

/**
 * Composant pour le scroll to top au changement de page
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

/**
 * Composant App principal
 */
const App = () => {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Rendu des routes
  const routing = useRoutes(routes);

  // Effet pour le titre de la page
  useEffect(() => {
    const pageTitles = {
      '/': 'Accueil',
      '/login': 'Connexion',
      '/dashboard': 'Tableau de bord',
      '/webmail': 'Webmail',
      '/mailboxes': 'Boîtes aux lettres',
      '/admin': 'Administration',
      '/admin/domains': 'Gestion des domaines',
      '/admin/users': 'Gestion des utilisateurs',
      '/admin/certificates': 'Certificats',
      '/admin/statistics': 'Statistiques',
      '/admin/annuaire': 'Annuaire',
      '/admin/monitoring': 'Monitoring',
    };

    const baseTitle = 'MSSanté';
    const pageTitle = pageTitles[location.pathname];
    
    document.title = pageTitle 
      ? `${pageTitle} | ${baseTitle}`
      : baseTitle;
  }, [location.pathname]);

  // Effet pour logger les changements de route (dev uniquement)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📍 Navigation:', location.pathname);
    }
  }, [location.pathname]);

  // Afficher le loader pendant l'initialisation de l'auth
  if (isLoading) {
    return <GlobalLoader />;
  }

  return (
    <>
      {/* Scroll to top on navigation */}
      <ScrollToTop />

      {/* Notifications toast */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* Contenu principal avec Suspense pour le lazy loading */}
      <Suspense fallback={<GlobalLoader />}>
        <div className="min-h-screen bg-gray-50">
          {routing}
        </div>
      </Suspense>

      {/* Indicateur de mode développement */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-medium shadow-lg">
            DEV MODE
            {user && (
              <span className="ml-2">
                | {user.email}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default App;