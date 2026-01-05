// services/frontend/src/contexts/index.js
/**
 * Export centralisé des contextes React
 */

// Contexte d'authentification
export { 
  AuthProvider, 
  useAuth, 
  default as AuthContext 
} from './AuthContext';

// Contexte de gestion des domaines
export { 
  DomainProvider, 
  useDomain, 
  default as DomainContext 
} from './DomainContext';

/**
 * Provider combiné pour wrapper l'application
 * Usage dans App.jsx :
 * 
 * import { AppProviders } from './contexts';
 * 
 * function App() {
 *   return (
 *     <AppProviders>
 *       <Router>
 *         <Routes />
 *       </Router>
 *     </AppProviders>
 *   );
 * }
 */
import React from 'react';
import { AuthProvider } from './AuthContext';
import { DomainProvider } from './DomainContext';

export const AppProviders = ({ children }) => {
  return (
    <AuthProvider>
      <DomainProvider>
        {children}
      </DomainProvider>
    </AuthProvider>
  );
};