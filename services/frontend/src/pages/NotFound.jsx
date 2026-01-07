// services/frontend/src/pages/NotFound.jsx
/**
 * Page 404 - Page non trouvée
 */

import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl mb-4">📧</div>
        <h1 className="text-7xl font-bold text-blue-800 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Page non trouvée
        </h2>
        <p className="text-gray-600 mb-8">
          Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <span>🏠</span>
            Retour à l'accueil
          </Link>
          <Link
            to="/webmail"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            <span>📬</span>
            Webmail
          </Link>
        </div>
        <p className="mt-8 text-sm text-gray-500">
          Besoin d'aide ?{' '}
          <Link to="/aide" className="text-blue-600 hover:underline">
            Consultez notre FAQ
          </Link>
        </p>
      </div>
    </div>
  );
};

export default NotFound;