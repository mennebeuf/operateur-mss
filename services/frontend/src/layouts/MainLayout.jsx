// services/frontend/src/layouts/MainLayout.jsx
import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const menuItems = [
    { path: '/dashboard', label: 'Tableau de bord', icon: '📊' },
    { path: '/webmail', label: 'Webmail', icon: '📧' },
    { path: '/mailboxes', label: 'Mes BAL', icon: '📬' },
    { path: '/contacts', label: 'Contacts', icon: '👥' },
    { path: '/settings', label: 'Paramètres', icon: '⚙️' }
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = path => location.pathname.startsWith(path);

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white shadow-lg transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b">
          {sidebarOpen ? (
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="text-2xl">🏥</span>
              <span className="font-bold text-blue-600">MSSanté</span>
            </Link>
          ) : (
            <Link to="/dashboard" className="mx-auto">
              <span className="text-2xl">🏥</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map(item => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>

          {/* Lien Admin si autorisé */}
          {(user?.is_super_admin || user?.role === 'domain_admin') && (
            <div className="mt-6 pt-6 border-t">
              <Link
                to="/admin"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive('/admin')
                    ? 'bg-purple-50 text-purple-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">🔧</span>
                {sidebarOpen && <span>Administration</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="p-4 border-t">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                {user?.first_name?.[0]}
                {user?.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                {user?.first_name?.[0]}
                {user?.last_name?.[0]}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-800">
              {menuItems.find(item => isActive(item.path))?.label || 'MSSanté'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <span className="text-xl">🔔</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </div>
                <span className="text-sm text-gray-700">{user?.first_name}</span>
                <span className="text-xs">▼</span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                    {user?.rpps_id && (
                      <p className="text-xs text-gray-400 mt-1">RPPS: {user.rpps_id}</p>
                    )}
                  </div>
                  <div className="p-2">
                    <Link
                      to="/settings/profile"
                      className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      👤 Mon profil
                    </Link>
                    <Link
                      to="/settings"
                      className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      ⚙️ Paramètres
                    </Link>
                    <hr className="my-2" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      🚪 Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="h-12 bg-white border-t flex items-center justify-center text-sm text-gray-500">
          © {new Date().getFullYear()} Opérateur MSSanté - Tous droits réservés
        </footer>
      </div>

      {/* Overlay pour fermer le menu user */}
      {userMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
      )}
    </div>
  );
};

export default MainLayout;
