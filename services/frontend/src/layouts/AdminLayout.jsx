// services/frontend/src/layouts/AdminLayout.jsx
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Vérifier les permissions
  useEffect(() => {
    if (!user || (!user.is_super_admin && user.role !== 'domain_admin')) {
      navigate('/');
    }
  }, [user, navigate]);

  const menuItems = [
    // Super Admin uniquement
    ...(user?.is_super_admin
      ? [
          {
            section: 'Super Administration',
            items: [
              { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
              { path: '/admin/domains', label: 'Domaines', icon: '🏢' },
              { path: '/admin/users', label: 'Utilisateurs', icon: '👥' },
              { path: '/admin/certificates', label: 'Certificats', icon: '🔐' },
              { path: '/admin/annuaire', label: 'Annuaire', icon: '📖' },
              { path: '/admin/statistics', label: 'Statistiques', icon: '📈' },
              { path: '/admin/monitoring', label: 'Monitoring', icon: '🖥️' },
              { path: '/admin/audit', label: 'Audit', icon: '📋' },
              { path: '/admin/settings', label: 'Configuration', icon: '⚙️' }
            ]
          }
        ]
      : []),
    // Admin domaine
    ...(user?.role === 'domain_admin' && !user?.is_super_admin
      ? [
          {
            section: 'Administration Domaine',
            items: [
              { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
              { path: '/admin/domain-users', label: 'Utilisateurs', icon: '👥' },
              { path: '/admin/domain-mailboxes', label: 'BAL', icon: '📬' },
              { path: '/admin/domain-stats', label: 'Statistiques', icon: '📈' }
            ]
          }
        ]
      : [])
  ];

  const isActive = path => location.pathname === path;

  const getCurrentPageTitle = () => {
    for (const section of menuItems) {
      const item = section.items.find(i => isActive(i.path));
      if (item) {return item.label;}
    }
    return 'Administration';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-800 transition-all duration-300 flex flex-col relative`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
          {sidebarOpen ? (
            <Link to="/admin/dashboard" className="flex items-center gap-2">
              <span className="text-2xl">🔧</span>
              <span className="font-bold text-white">Admin Panel</span>
            </Link>
          ) : (
            <Link to="/admin/dashboard" className="mx-auto">
              <span className="text-2xl">🔧</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {menuItems.map((section, idx) => (
            <div key={idx} className="mb-6">
              {sidebarOpen && (
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-4">
                  {section.section}
                </h3>
              )}
              <ul className="space-y-1">
                {section.items.map(item => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive(item.path)
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                      title={!sidebarOpen ? item.label : undefined}
                    >
                      <span className="text-xl">{item.icon}</span>
                      {sidebarOpen && <span className="text-sm">{item.label}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Retour à l'app */}
        <div className="p-4 border-t border-gray-700">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <span className="text-xl">🏠</span>
            {sidebarOpen && <span className="text-sm">Retour à l'application</span>}
          </Link>
        </div>

        {/* User info */}
        <div className="p-4 border-t border-gray-700">
          {sidebarOpen ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div className="text-xs text-gray-400">{user?.email}</div>
                </div>
              </div>
              {user?.is_super_admin && (
                <span className="inline-block px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded mb-3">
                  SUPER ADMIN
                </span>
              )}
              <button
                onClick={handleLogout}
                className="w-full text-left text-sm text-red-400 hover:text-red-300 flex items-center gap-2"
              >
                🚪 Déconnexion
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                {user?.first_name?.[0]}
                {user?.last_name?.[0]}
              </div>
              <button
                onClick={handleLogout}
                className="text-xl text-red-400 hover:text-red-300"
                title="Déconnexion"
              >
                🚪
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">{getCurrentPageTitle()}</h2>
            {user?.is_super_admin && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                SUPER ADMIN
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Alertes système */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <span className="text-xl">⚠️</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
            </button>

            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <span className="text-xl">🔔</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Quick actions */}
            <Link
              to="/webmail"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📧 Webmail
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-gray-100 p-6">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="h-10 bg-white border-t flex items-center justify-center text-xs text-gray-500">
          Panel d'Administration - Opérateur MSSanté © {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;
