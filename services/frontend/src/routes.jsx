/**
 * MSSanté Frontend - Configuration des Routes
 * services/frontend/src/routes.jsx
 *
 * Définition de toutes les routes de l'application
 * avec lazy loading et protection des routes
 */

import React, { lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

// Guards
import AdminRoute from './components/Common/AdminRoute';
import ProtectedRoute from './components/Common/ProtectedRoute';
// Layouts
import AdminLayout from './layouts/AdminLayout';
import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';

// ============================================
// LAZY LOADING DES PAGES
// ============================================

// Pages Auth
const Login = lazy(() => import('./pages/Auth/Login'));
const PSCCallback = lazy(() => import('./pages/Auth/PSCCallback'));

// Pages principales
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Webmail = lazy(() => import('./pages/Webmail'));

// Pages Mailboxes
const MailboxList = lazy(() => import('./pages/Mailboxes/MailboxList'));
const MailboxCreate = lazy(() => import('./pages/Mailboxes/MailboxCreate'));
const MailboxSettings = lazy(() => import('./pages/Mailboxes/MailboxSettings'));

// Pages Admin
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));

// Admin - Domains
const DomainsList = lazy(() => import('./pages/Admin/Domains/DomainsList'));
const DomainCreate = lazy(() => import('./pages/Admin/Domains/DomainCreate'));
const DomainEdit = lazy(() => import('./pages/Admin/Domains/DomainEdit'));
const DomainView = lazy(() => import('./pages/Admin/Domains/DomainView'));

// Admin - Users
const UsersList = lazy(() => import('./pages/Admin/Users/UsersList'));
const UserCreate = lazy(() => import('./pages/Admin/Users/UserCreate'));
const UserEdit = lazy(() => import('./pages/Admin/Users/UserEdit'));

// Admin - Certificates
const CertificatesList = lazy(() => import('./pages/Admin/Certificates/CertificatesList'));
const CertificateUpload = lazy(() => import('./pages/Admin/Certificates/CertificateUpload'));

// Admin - Annuaire
const AnnuaireReports = lazy(() => import('./pages/Admin/Annuaire/AnnuaireReports'));
const MonthlyIndicators = lazy(() => import('./pages/Admin/Annuaire/MonthlyIndicators'));

// Admin - Statistics & Monitoring
const GlobalStats = lazy(() => import('./pages/Admin/Statistics/GlobalStats'));
const SystemHealth = lazy(() => import('./pages/Admin/Monitoring/SystemHealth'));

// Page 404
const NotFound = lazy(() => import('./pages/NotFound'));

// ============================================
// CONFIGURATION DES ROUTES
// ============================================

const routes = [
  // ==========================================
  // ROUTES PUBLIQUES (Auth)
  // ==========================================
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <Login />
      },
      {
        path: 'psc/callback',
        element: <PSCCallback />
      },
      {
        // Redirection par défaut
        index: true,
        element: <Navigate to="/auth/login" replace />
      }
    ]
  },

  // Alias pour /login
  {
    path: '/login',
    element: <Navigate to="/auth/login" replace />
  },

  // ==========================================
  // ROUTES PROTÉGÉES (Utilisateurs connectés)
  // ==========================================
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      // Dashboard (page d'accueil)
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: 'dashboard',
        element: <Dashboard />
      },

      // Webmail
      {
        path: 'webmail',
        element: <Webmail />
      },
      {
        path: 'webmail/:folder',
        element: <Webmail />
      },
      {
        path: 'webmail/:folder/:messageId',
        element: <Webmail />
      },
      {
        path: 'webmail/compose',
        element: <Webmail />
      },

      // Gestion des boîtes aux lettres
      {
        path: 'mailboxes',
        element: <Outlet />,
        children: [
          {
            index: true,
            element: <MailboxList />
          },
          {
            path: 'new',
            element: <MailboxCreate />
          },
          {
            path: ':mailboxId/settings',
            element: <MailboxSettings />
          }
        ]
      },

      // Profil utilisateur
      {
        path: 'profile',
        element: lazy(() => import('./pages/Profile')) ? (
          <React.Suspense fallback={null}>
            {React.createElement(lazy(() => import('./pages/Profile')))}
          </React.Suspense>
        ) : (
          <Navigate to="/dashboard" />
        )
      },

      // Paramètres
      {
        path: 'settings',
        element: lazy(() => import('./pages/Settings')) ? (
          <React.Suspense fallback={null}>
            {React.createElement(lazy(() => import('./pages/Settings')))}
          </React.Suspense>
        ) : (
          <Navigate to="/dashboard" />
        )
      }
    ]
  },

  // ==========================================
  // ROUTES ADMIN (Super Admin & Domain Admin)
  // ==========================================
  {
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminLayout />
      </AdminRoute>
    ),
    children: [
      // Dashboard Admin
      {
        index: true,
        element: <AdminDashboard />
      },

      // Gestion des domaines (Super Admin uniquement)
      {
        path: 'domains',
        element: <Outlet />,
        children: [
          {
            index: true,
            element: <DomainsList />
          },
          {
            path: 'new',
            element: <DomainCreate />
          },
          {
            path: ':domainId',
            element: <DomainView />
          },
          {
            path: ':domainId/edit',
            element: <DomainEdit />
          }
        ]
      },

      // Gestion des utilisateurs
      {
        path: 'users',
        element: <Outlet />,
        children: [
          {
            index: true,
            element: <UsersList />
          },
          {
            path: 'new',
            element: <UserCreate />
          },
          {
            path: ':userId/edit',
            element: <UserEdit />
          }
        ]
      },

      // Gestion des certificats
      {
        path: 'certificates',
        element: <Outlet />,
        children: [
          {
            index: true,
            element: <CertificatesList />
          },
          {
            path: 'upload',
            element: <CertificateUpload />
          },
          {
            path: ':certId/renew',
            element: <CertificateUpload />
          }
        ]
      },

      // Annuaire ANS
      {
        path: 'annuaire',
        element: <Outlet />,
        children: [
          {
            index: true,
            element: <AnnuaireReports />
          },
          {
            path: 'reports',
            element: <AnnuaireReports />
          },
          {
            path: 'indicators',
            element: <MonthlyIndicators />
          }
        ]
      },

      // Statistiques
      {
        path: 'statistics',
        element: <GlobalStats />
      },

      // Monitoring
      {
        path: 'monitoring',
        element: <SystemHealth />
      },

      // Logs d'audit
      {
        path: 'audit',
        element: lazy(() => import('./pages/Admin/Audit/AuditLogs')) ? (
          <React.Suspense fallback={null}>
            {React.createElement(lazy(() => import('./pages/Admin/Audit/AuditLogs')))}
          </React.Suspense>
        ) : (
          <Navigate to="/admin" />
        )
      },

      // Paramètres système
      {
        path: 'settings',
        element: lazy(() => import('./pages/Admin/Settings/SystemSettings')) ? (
          <React.Suspense fallback={null}>
            {React.createElement(lazy(() => import('./pages/Admin/Settings/SystemSettings')))}
          </React.Suspense>
        ) : (
          <Navigate to="/admin" />
        )
      }
    ]
  },

  // ==========================================
  // ROUTES DE FALLBACK
  // ==========================================
  {
    path: '/404',
    element: <NotFound />
  },
  {
    path: '*',
    element: <Navigate to="/404" replace />
  }
];

export default routes;
