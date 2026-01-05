// services/frontend/src/pages/Auth/Logout.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Logout = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [status, setStatus] = useState('processing');
  
  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout();
        setStatus('success');
        
        // Rediriger vers la page de connexion après un court délai
        setTimeout(() => {
          navigate('/auth/login', { replace: true });
        }, 2000);
        
      } catch (err) {
        console.error('Erreur lors de la déconnexion:', err);
        setStatus('error');
        
        // Rediriger quand même après un délai
        setTimeout(() => {
          navigate('/auth/login', { replace: true });
        }, 3000);
      }
    };
    
    performLogout();
  }, [logout, navigate]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          {status === 'processing' && (
            <>
              <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Déconnexion en cours...
              </h2>
              <p className="text-sm text-gray-600">
                Fermeture de votre session sécurisée
              </p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Déconnexion réussie
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Votre session a été fermée en toute sécurité.
              </p>
              <p className="text-xs text-gray-500">
                Redirection vers la page de connexion...
              </p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="mx-auto h-16 w-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
                <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Attention
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Un problème est survenu lors de la déconnexion, mais votre session locale a été effacée.
              </p>
              <p className="text-xs text-gray-500">
                Redirection vers la page de connexion...
              </p>
            </>
          )}
        </div>
        
        {/* Conseils de sécurité */}
        <div className="mt-6 p-4 bg-white/50 rounded-lg">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Conseils de sécurité
          </h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Fermez toutes les fenêtres du navigateur si vous utilisez un ordinateur partagé</li>
            <li>• Ne laissez pas votre carte CPS dans le lecteur</li>
            <li>• Verrouillez votre session Windows/Mac</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Logout;