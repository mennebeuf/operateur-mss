// services/frontend/src/layouts/AuthLayout.jsx
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AuthLayout = () => {
  const { user, loading } = useAuth();

  // Rediriger vers le dashboard si déjà connecté
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Afficher un loader pendant la vérification de l'auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-600 to-blue-800">
      {/* Panneau gauche - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12">
        <div className="max-w-md text-center">
          {/* Logo */}
          <div className="mb-8">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">🏥</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">MSSanté</h1>
            <p className="text-xl text-blue-100">Opérateur de Messagerie Sécurisée</p>
          </div>

          {/* Features */}
          <div className="space-y-6 text-left">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-500 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🔐</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Sécurité renforcée</h3>
                <p className="text-blue-200 text-sm">
                  Authentification Pro Santé Connect et certificats IGC-Santé
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-500 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xl">✉️</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Messagerie conforme</h3>
                <p className="text-blue-200 text-sm">
                  Échanges de données de santé conformes à la réglementation
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-500 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xl">📖</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Annuaire intégré</h3>
                <p className="text-blue-200 text-sm">
                  Publication automatique dans l'annuaire national MSSanté
                </p>
              </div>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 pt-8 border-t border-blue-500 border-opacity-30">
            <p className="text-blue-200 text-sm mb-4">Conforme aux exigences de l'ANS</p>
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <div className="text-2xl mb-1">🏛️</div>
                <p className="text-xs text-blue-200">ANS</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">🔒</div>
                <p className="text-xs text-blue-200">IGC-Santé</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">✅</div>
                <p className="text-xs text-blue-200">RGPD</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panneau droit - Formulaire */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏥</span>
            </div>
            <h1 className="text-2xl font-bold text-white">MSSanté</h1>
          </div>

          {/* Card du formulaire */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <Outlet />
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-blue-200 text-sm">
              © {new Date().getFullYear()} Opérateur MSSanté
            </p>
            <div className="mt-2 flex justify-center gap-4 text-xs">
              <a href="/mentions-legales" className="text-blue-200 hover:text-white">
                Mentions légales
              </a>
              <span className="text-blue-400">•</span>
              <a href="/politique-confidentialite" className="text-blue-200 hover:text-white">
                Confidentialité
              </a>
              <span className="text-blue-400">•</span>
              <a href="/aide" className="text-blue-200 hover:text-white">
                Aide
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;