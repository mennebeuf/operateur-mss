/**
 * MSSanté Frontend - Point d'entrée principal
 * services/frontend/src/index.jsx
 *
 * Ce fichier initialise l'application React et configure
 * les providers globaux (Auth, Domain, Query, etc.)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Styles globaux
import './styles/index.css';

import App from './App';
// Providers
import { AuthProvider } from './contexts/AuthContext';
import { DomainProvider } from './contexts/DomainContext';
// Application principale

// Configuration React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Durée de mise en cache des données
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Durée de conservation en cache après unmount
      cacheTime: 10 * 60 * 1000, // 10 minutes
      // Nombre de tentatives en cas d'erreur
      retry: (failureCount, error) => {
        // Ne pas retry pour les erreurs 4xx
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      // Délai entre les retries
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch au focus de la fenêtre
      refetchOnWindowFocus: false,
      // Refetch à la reconnexion
      refetchOnReconnect: true
    },
    mutations: {
      // Retry pour les mutations
      retry: 1
    }
  }
});

// Configuration de l'environnement
const isDevelopment = process.env.NODE_ENV === 'development';

// Logging en développement
if (isDevelopment) {
  console.log('🚀 MSSanté Frontend démarré en mode développement');
  console.log('📡 API URL:', process.env.REACT_APP_API_URL || '/api');
  console.log(
    '🔐 PSC Client ID:',
    process.env.REACT_APP_PSC_CLIENT_ID ? '✓ Configuré' : '✗ Non configuré'
  );
}

// Gestion des erreurs globales non capturées
window.addEventListener('unhandledrejection', event => {
  console.error('Promesse non gérée:', event.reason);

  // En production, envoyer à un service de monitoring
  if (!isDevelopment) {
    // TODO: Intégrer Sentry ou autre service de monitoring
    // Sentry.captureException(event.reason);
  }
});

// Point de montage de l'application
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Élément root non trouvé. Vérifiez que le fichier public/index.html contient un élément avec id="root".'
  );
}

// Création du root React 18
const root = ReactDOM.createRoot(rootElement);

// Rendu de l'application
root.render(
  <React.StrictMode>
    {/* React Query - Gestion du cache et des requêtes */}
    <QueryClientProvider client={queryClient}>
      {/* Router - Navigation */}
      <BrowserRouter>
        {/* Authentification - Contexte utilisateur */}
        <AuthProvider>
          {/* Domaine - Contexte multi-tenant */}
          <DomainProvider>
            {/* Application principale */}
            <App />
          </DomainProvider>
        </AuthProvider>
      </BrowserRouter>

      {/* DevTools React Query (uniquement en développement) */}
      {isDevelopment && <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />}
    </QueryClientProvider>
  </React.StrictMode>
);

// Hot Module Replacement pour le développement
if (isDevelopment && module.hot) {
  module.hot.accept('./App', () => {
    console.log('🔄 Hot reload App');
  });
}

// Service Worker pour le mode offline (PWA)
// Décommenter pour activer le mode PWA
/*
if ('serviceWorker' in navigator && !isDevelopment) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ Service Worker enregistré:', registration.scope);
      })
      .catch((error) => {
        console.error('❌ Erreur Service Worker:', error);
      });
  });
}
*/

// Mesure des performances (Web Vitals)
// Décommenter pour activer les métriques de performance
/*
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    getCLS(onPerfEntry);
    getFID(onPerfEntry);
    getFCP(onPerfEntry);
    getLCP(onPerfEntry);
    getTTFB(onPerfEntry);
  }
};

reportWebVitals(console.log);
*/
