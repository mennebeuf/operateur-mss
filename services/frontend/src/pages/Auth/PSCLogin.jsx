// services/frontend/src/pages/Auth/PSCLogin.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Génère un state aléatoire pour la protection CSRF
 */
const generateState = () => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Génère un code_verifier pour PKCE
 */
const generateCodeVerifier = () => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Génère le code_challenge à partir du code_verifier
 */
const generateCodeChallenge = async (codeVerifier) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const PSCLogin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Rediriger si déjà connecté
  useEffect(() => {
    if (user) {
      navigate('/webmail');
    }
  }, [user, navigate]);
  
  const handlePSCLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Générer les paramètres de sécurité
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      // Stocker dans sessionStorage pour la vérification au callback
      sessionStorage.setItem('psc_state', state);
      sessionStorage.setItem('psc_code_verifier', codeVerifier);
      sessionStorage.setItem('psc_redirect_uri', window.location.origin + '/auth/psc/callback');
      
      // Construire l'URL d'autorisation PSC
      const pscAuthUrl = process.env.REACT_APP_PSC_AUTHORIZATION_URL || 
        'https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth';
      
      const params = new URLSearchParams({
        client_id: process.env.REACT_APP_PSC_CLIENT_ID,
        response_type: 'code',
        redirect_uri: `${window.location.origin}/auth/psc/callback`,
        scope: 'openid email profile scope_all',
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        acr_values: 'eidas2'
      });
      
      // Redirection vers Pro Santé Connect
      window.location.href = `${pscAuthUrl}?${params.toString()}`;
      
    } catch (err) {
      console.error('Erreur initialisation PSC:', err);
      setError('Erreur lors de l\'initialisation de l\'authentification');
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo et titre */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-3xl">🏥</span>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Connexion Pro Santé Connect
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Authentification sécurisée pour les professionnels de santé
          </p>
        </div>
        
        {/* Carte principale */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {/* Informations sur PSC */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">
              Pro Santé Connect
            </h3>
            <p className="text-xs text-blue-700">
              Pro Santé Connect est le service d'authentification de l'Agence du Numérique en Santé 
              permettant aux professionnels de santé de s'identifier de manière sécurisée avec leur 
              carte CPS ou e-CPS.
            </p>
          </div>
          
          {/* Bouton de connexion PSC */}
          <button
            onClick={handlePSCLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 border-2 border-transparent rounded-lg shadow-lg text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Redirection en cours...</span>
              </>
            ) : (
              <>
                <img 
                  src="/images/psc-logo.svg" 
                  alt="" 
                  className="h-6 w-6"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <span>Se connecter avec Pro Santé Connect</span>
              </>
            )}
          </button>
          
          {/* Méthodes d'authentification */}
          <div className="mt-6">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Méthodes d'authentification acceptées
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <span className="text-xl">💳</span>
                <span className="text-xs text-gray-600">Carte CPS</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <span className="text-xl">📱</span>
                <span className="text-xs text-gray-600">e-CPS</span>
              </div>
            </div>
          </div>
          
          {/* Séparateur */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Ou
                </span>
              </div>
            </div>
          </div>
          
          {/* Lien vers login admin */}
          <div className="mt-6 text-center">
            <Link
              to="/auth/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-500 transition"
            >
              Connexion administrateur →
            </Link>
          </div>
        </div>
        
        {/* Aide */}
        <div className="text-center space-y-2">
          <p className="text-xs text-gray-500">
            Vous n'avez pas de carte CPS ou e-CPS ?
          </p>
          <a 
            href="https://esante.gouv.fr/produits-services/e-cps" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:text-blue-500"
          >
            Obtenir une e-CPS
          </a>
        </div>
        
        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Service conforme au référentiel MSSanté de l'ANS
        </p>
      </div>
    </div>
  );
};

export default PSCLogin;