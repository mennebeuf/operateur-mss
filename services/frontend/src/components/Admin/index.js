// services/frontend/src/components/Admin/index.js

/**
 * Point d'entrée pour les composants Admin
 * Permet l'import centralisé des composants d'administration
 */

export { default as UserManagement } from './UserManagement';
export { default as CertificateManagement } from './CertificateManagement';

// Composants utilitaires partagés
export { default as StatCard } from './shared/StatCard';
export { default as DataTable } from './shared/DataTable';
export { default as ConfirmModal } from './shared/ConfirmModal';
export { default as SearchFilter } from './shared/SearchFilter';
export { default as Pagination } from './shared/Pagination';
export { default as StatusBadge } from './shared/StatusBadge';