// services/frontend/src/hooks/usePermissions.js
/**
 * Hook personnalisé pour la gestion des permissions
 * Gère les autorisations basées sur les rôles et les domaines
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';

/**
 * Définition des permissions par rôle
 */
const ROLE_PERMISSIONS = {
  super_admin: [
    'domains.create',
    'domains.read',
    'domains.update',
    'domains.delete',
    'users.create',
    'users.read',
    'users.update',
    'users.delete',
    'users.manage_all',
    'mailboxes.create',
    'mailboxes.read',
    'mailboxes.update',
    'mailboxes.delete',
    'certificates.upload',
    'certificates.read',
    'certificates.delete',
    'certificates.manage_all',
    'annuaire.sync',
    'annuaire.read',
    'statistics.read',
    'statistics.export',
    'settings.read',
    'settings.update',
    'audit.read',
    'monitoring.read',
    'admin.access'
  ],
  domain_admin: [
    'users.create',
    'users.read',
    'users.update',
    'users.delete',
    'mailboxes.create',
    'mailboxes.read',
    'mailboxes.update',
    'mailboxes.delete',
    'certificates.upload',
    'certificates.read',
    'annuaire.read',
    'statistics.read',
    'admin.access'
  ],
  user: [
    'mailboxes.read',
    'email.send',
    'email.read',
    'profile.read',
    'profile.update'
  ]
};

/**
 * Hook principal de gestion des permissions
 */
export const usePermissions = () => {
  const { user, isSuperAdmin, isDomainAdmin, currentDomain } = useAuth();

  /**
   * Obtient toutes les permissions de l'utilisateur actuel
   */
  const permissions = useMemo(() => {
    if (!user) return [];
    
    const role = user.is_super_admin ? 'super_admin' : user.role || 'user';
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;
  }, [user]);

  /**
   * Vérifie si l'utilisateur a une permission spécifique
   */
  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    return permissions.includes(permission);
  }, [user, isSuperAdmin, permissions]);

  /**
   * Vérifie si l'utilisateur a toutes les permissions spécifiées
   */
  const hasAllPermissions = useCallback((permissionList) => {
    if (!Array.isArray(permissionList)) return false;
    return permissionList.every(p => hasPermission(p));
  }, [hasPermission]);

  /**
   * Vérifie si l'utilisateur a au moins une des permissions spécifiées
   */
  const hasAnyPermission = useCallback((permissionList) => {
    if (!Array.isArray(permissionList)) return false;
    return permissionList.some(p => hasPermission(p));
  }, [hasPermission]);

  /**
   * Vérifie si l'utilisateur peut gérer un domaine spécifique
   */
  const canManageDomain = useCallback((domainId) => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    if (!isDomainAdmin) return false;
    
    // Vérifier si l'admin gère ce domaine
    if (user.domains && Array.isArray(user.domains)) {
      return user.domains.some(d => d.id === domainId || d === domainId);
    }
    return currentDomain?.id === domainId;
  }, [user, isSuperAdmin, isDomainAdmin, currentDomain]);

  /**
   * Vérifie si l'utilisateur peut gérer un autre utilisateur
   */
  const canManageUser = useCallback((targetUser) => {
    if (!user || !targetUser) return false;
    if (isSuperAdmin) return true;
    
    // Un admin de domaine ne peut pas gérer un super admin
    if (targetUser.is_super_admin || targetUser.role === 'super_admin') {
      return false;
    }
    
    // Vérifier si l'utilisateur cible appartient au même domaine
    if (isDomainAdmin) {
      return canManageDomain(targetUser.domain_id || targetUser.domain?.id);
    }
    
    return false;
  }, [user, isSuperAdmin, isDomainAdmin, canManageDomain]);

  /**
   * Vérifie si l'utilisateur peut accéder à l'interface admin
   */
  const canAccessAdmin = useMemo(() => {
    return hasPermission('admin.access');
  }, [hasPermission]);

  /**
   * Vérifie les permissions pour les opérations CRUD
   */
  const canCreate = useCallback((resource) => {
    return hasPermission(`${resource}.create`);
  }, [hasPermission]);

  const canRead = useCallback((resource) => {
    return hasPermission(`${resource}.read`);
  }, [hasPermission]);

  const canUpdate = useCallback((resource) => {
    return hasPermission(`${resource}.update`);
  }, [hasPermission]);

  const canDelete = useCallback((resource) => {
    return hasPermission(`${resource}.delete`);
  }, [hasPermission]);

  /**
   * Obtient le niveau d'accès de l'utilisateur
   */
  const accessLevel = useMemo(() => {
    if (isSuperAdmin) return 'super_admin';
    if (isDomainAdmin) return 'domain_admin';
    return 'user';
  }, [isSuperAdmin, isDomainAdmin]);

  /**
   * Liste des domaines gérables par l'utilisateur
   */
  const managedDomains = useMemo(() => {
    if (!user) return [];
    if (isSuperAdmin) return user.allDomains || [];
    if (isDomainAdmin && user.domains) return user.domains;
    return currentDomain ? [currentDomain] : [];
  }, [user, isSuperAdmin, isDomainAdmin, currentDomain]);

  return {
    // État
    permissions,
    accessLevel,
    managedDomains,
    canAccessAdmin,
    
    // Méthodes de vérification
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    canManageDomain,
    canManageUser,
    
    // Raccourcis CRUD
    canCreate,
    canRead,
    canUpdate,
    canDelete
  };
};

/**
 * Hook pour conditionner l'affichage basé sur les permissions
 */
export const usePermissionGuard = (requiredPermission) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const isAllowed = useMemo(() => {
    if (typeof requiredPermission === 'string') {
      return hasPermission(requiredPermission);
    }
    if (Array.isArray(requiredPermission)) {
      return hasAnyPermission(requiredPermission);
    }
    return false;
  }, [requiredPermission, hasPermission, hasAnyPermission]);

  return { isAllowed };
};

/**
 * Composant HOC pour protéger les composants avec permissions
 */
export const withPermission = (Component, requiredPermission) => {
  return function PermissionWrapper(props) {
    const { isAllowed } = usePermissionGuard(requiredPermission);
    
    if (!isAllowed) {
      return null;
    }
    
    return <Component {...props} />;
  };
};

export default usePermissions;