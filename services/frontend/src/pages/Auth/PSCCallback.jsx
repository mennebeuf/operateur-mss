// services/frontend/src/pages/Auth/PSCCallback.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const PSCCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithPSC } = useAuth();
  
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');
  
  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Récupérer les paramètres de l'URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        // Vérifier si PSC a retourné une erreur
        if (errorParam) {
          throw new Error(errorDescription || `Erreur PSC: ${errorParam}`);
        }
        
        // Vérifier la présence du code d'autorisation
        if (!code) {
          throw new Error('Code d\'autorisation manquant');
        }
        
        // Vérifier le state (protection CSRF)
        const storedState = sessionStorage.getItem('psc_state');
        if (!storedState || state !== storedState) {
          throw new Error('État de session invalide. Veuillez réessayer.');
        }
        
        // Récupérer le code_verifier pour PKCE
        const codeVerifier = sessionStorage.getItem('psc_code_verifier');
        if (!codeVerifier) {
          throw new Error('Paramètres de session manquants');
        }
        
        setStatus('authenticating');
        
        // Échanger le code contre un token via l'API backend
        const response = await axios.post('/api/v1/auth/psc/token', {
          code,
          state,
          code_verifier: codeVerifier,
          redirect_uri: sessionStorage.getItem('psc_redirect_uri')
        });
        
        if (!response.data.success) {
          throw new Error(response.data.error || 'Erreur lors de l\'authentification');
        }
        
        // Nettoyer sessionStorage
        sessionStorage.removeItem('psc_state');
        sessionStorage.removeItem('psc_code_verifier');
        sessionStorage.removeItem('psc_redirect_uri');
        
        // Connecter l'utilisateur
        await loginWithPSC(response.data.data);
        
        setStatus('success');
        
        // Rediriger vers le webmail après un court délai
        setTimeout(() => {
          navigate('/webmail', { replace: true });
        }, 1500);
        
      } catch (err) {
        console.error('Erreur callback PSC:', err);
        setStatus('error');
        setError(err.response?.data?.error || err.message || 'Erreur d\'authentification');
        
        // Nettoyer sessionStorage en cas d'erreur
        sessionStorage.removeItem('psc_state');
        sessionStorage.removeItem('psc_code_verifier');
        sessionStorage.removeItem('psc_redirect_uri');
      }
    };
    
    handleCallback();
  }, [searchParams, loginWithPSC, navigate]);
  
  const handleRetry = () => {
    navigate('/auth/psc');
  };
  
  const handleBackToLogin = () => {
    navigate('/auth/login');
  };
  
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
                Vérification en cours...
              </h2>
              <p className="text-sm text-gray-600">
                Traitement de votre authentification Pro Santé Connect
              </p>
            </>
          )}
          
          {status === 'authenticating' && (
            <>
              <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Authentification...
              </h2>
              <p className="text-sm text-gray-600">
                Connexion à votre compte MSSanté
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
                Connexion réussie !
              </h2>
              <p className="text-sm text-gray-600">
                Redirection vers votre messagerie...
              </p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Erreur d'authentification
              </h2>
              <p className="text-sm text-red-600 mb-6">
                {error}
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
                >
                  Réessayer avec Pro Santé Connect
                </button>
                <button
                  onClick={handleBackToLogin}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
                >
                  Retour à la page de connexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PSCCallback;