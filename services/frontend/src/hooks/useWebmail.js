// services/frontend/src/hooks/useWebmail.js
/**
 * Hook personnalisé pour la gestion du webmail
 * Gère les dossiers, messages, envoi et actions sur les emails
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { emailApi } from '../services/emailApi';

/**
 * Hook principal pour le webmail
 */
export const useWebmail = () => {
  // État des dossiers
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState('INBOX');
  const [foldersLoading, setFoldersLoading] = useState(false);
  
  // État des messages
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  
  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  
  // Recherche
  const [searchQuery, setSearchQuery] = useState('');
  
  // Erreurs
  const [error, setError] = useState(null);
  
  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState(new Set());

  /**
   * Charge les dossiers de la boîte mail
   */
  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    setError(null);
    try {
      const data = await emailApi.getFolders();
      setFolders(data.folders || data);
    } catch (err) {
      setError('Erreur lors du chargement des dossiers');
      console.error('Erreur loadFolders:', err);
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  /**
   * Charge les messages d'un dossier
   */
  const loadMessages = useCallback(async (folder = currentFolder, page = 1, search = searchQuery) => {
    setMessagesLoading(true);
    setError(null);
    try {
      const data = await emailApi.getMessages(folder, page, pagination.limit, search || null);
      setMessages(data.messages || data.data || []);
      setPagination(prev => ({
        ...prev,
        page: data.page || page,
        total: data.total || 0,
        totalPages: data.totalPages || Math.ceil((data.total || 0) / prev.limit)
      }));
      setSelectedIds(new Set());
    } catch (err) {
      setError('Erreur lors du chargement des messages');
      console.error('Erreur loadMessages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, [currentFolder, pagination.limit, searchQuery]);

  /**
   * Charge un message spécifique
   */
  const loadMessage = useCallback(async (uid, folder = currentFolder) => {
    setMessageLoading(true);
    setError(null);
    try {
      const data = await emailApi.getMessage(uid, folder);
      setSelectedMessage(data);
      
      // Marquer comme lu si nécessaire
      if (data && !data.flags?.includes('\\Seen')) {
        await markAsRead([uid], folder);
      }
      
      return data;
    } catch (err) {
      setError('Erreur lors du chargement du message');
      console.error('Erreur loadMessage:', err);
      return null;
    } finally {
      setMessageLoading(false);
    }
  }, [currentFolder]);

  /**
   * Change de dossier
   */
  const changeFolder = useCallback(async (folderName) => {
    setCurrentFolder(folderName);
    setSelectedMessage(null);
    setSelectedIds(new Set());
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadMessages(folderName, 1, '');
    setSearchQuery('');
  }, [loadMessages]);

  /**
   * Recherche dans les messages
   */
  const search = useCallback(async (query) => {
    setSearchQuery(query);
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadMessages(currentFolder, 1, query);
  }, [currentFolder, loadMessages]);

  /**
   * Change de page
   */
  const goToPage = useCallback(async (page) => {
    if (page < 1 || page > pagination.totalPages) return;
    await loadMessages(currentFolder, page, searchQuery);
  }, [currentFolder, pagination.totalPages, searchQuery, loadMessages]);

  /**
   * Envoie un message
   */
  const sendMessage = useCallback(async (messageData) => {
    setError(null);
    try {
      const result = await emailApi.sendMessage(messageData);
      return { success: true, data: result };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erreur lors de l\'envoi';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Sauvegarde un brouillon
   */
  const saveDraft = useCallback(async (messageData) => {
    setError(null);
    try {
      const result = await emailApi.saveDraft(messageData);
      return { success: true, data: result };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erreur lors de la sauvegarde';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Marque des messages comme lus
   */
  const markAsRead = useCallback(async (uids, folder = currentFolder) => {
    try {
      await emailApi.setFlags(uids, folder, { add: ['\\Seen'] });
      setMessages(prev => prev.map(msg => 
        uids.includes(msg.uid) 
          ? { ...msg, flags: [...(msg.flags || []), '\\Seen'] }
          : msg
      ));
      if (selectedMessage && uids.includes(selectedMessage.uid)) {
        setSelectedMessage(prev => ({
          ...prev,
          flags: [...(prev.flags || []), '\\Seen']
        }));
      }
    } catch (err) {
      console.error('Erreur markAsRead:', err);
    }
  }, [currentFolder, selectedMessage]);

  /**
   * Marque des messages comme non lus
   */
  const markAsUnread = useCallback(async (uids, folder = currentFolder) => {
    try {
      await emailApi.setFlags(uids, folder, { remove: ['\\Seen'] });
      setMessages(prev => prev.map(msg => 
        uids.includes(msg.uid)
          ? { ...msg, flags: (msg.flags || []).filter(f => f !== '\\Seen') }
          : msg
      ));
    } catch (err) {
      console.error('Erreur markAsUnread:', err);
    }
  }, [currentFolder]);

  /**
   * Marque/Démarque des messages comme favoris
   */
  const toggleFlag = useCallback(async (uids, flag = '\\Flagged', folder = currentFolder) => {
    try {
      const message = messages.find(m => uids.includes(m.uid));
      const hasFlag = message?.flags?.includes(flag);
      
      await emailApi.setFlags(uids, folder, hasFlag ? { remove: [flag] } : { add: [flag] });
      
      setMessages(prev => prev.map(msg => {
        if (!uids.includes(msg.uid)) return msg;
        const newFlags = hasFlag
          ? (msg.flags || []).filter(f => f !== flag)
          : [...(msg.flags || []), flag];
        return { ...msg, flags: newFlags };
      }));
    } catch (err) {
      console.error('Erreur toggleFlag:', err);
    }
  }, [currentFolder, messages]);

  /**
   * Déplace des messages vers un autre dossier
   */
  const moveMessages = useCallback(async (uids, toFolder, fromFolder = currentFolder) => {
    try {
      await emailApi.moveMessages(fromFolder, toFolder, uids);
      setMessages(prev => prev.filter(msg => !uids.includes(msg.uid)));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        uids.forEach(uid => newSet.delete(uid));
        return newSet;
      });
      if (selectedMessage && uids.includes(selectedMessage.uid)) {
        setSelectedMessage(null);
      }
      return { success: true };
    } catch (err) {
      setError('Erreur lors du déplacement');
      return { success: false, error: err.message };
    }
  }, [currentFolder, selectedMessage]);

  /**
   * Supprime des messages (déplace vers la corbeille)
   */
  const deleteMessages = useCallback(async (uids, folder = currentFolder) => {
    try {
      await emailApi.deleteMessages(folder, uids);
      setMessages(prev => prev.filter(msg => !uids.includes(msg.uid)));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        uids.forEach(uid => newSet.delete(uid));
        return newSet;
      });
      if (selectedMessage && uids.includes(selectedMessage.uid)) {
        setSelectedMessage(null);
      }
      return { success: true };
    } catch (err) {
      setError('Erreur lors de la suppression');
      return { success: false, error: err.message };
    }
  }, [currentFolder, selectedMessage]);

  /**
   * Gère la sélection des messages
   */
  const toggleSelection = useCallback((uid) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uid)) {
        newSet.delete(uid);
      } else {
        newSet.add(uid);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(messages.map(m => m.uid)));
  }, [messages]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Compte des messages non lus dans le dossier courant
   */
  const unreadCount = useMemo(() => {
    return messages.filter(m => !m.flags?.includes('\\Seen')).length;
  }, [messages]);

  /**
   * Statistiques des dossiers
   */
  const folderStats = useMemo(() => {
    return folders.reduce((acc, folder) => {
      acc[folder.name] = {
        total: folder.total || 0,
        unread: folder.unread || 0
      };
      return acc;
    }, {});
  }, [folders]);

  // Chargement initial
  useEffect(() => {
    loadFolders();
    loadMessages();
  }, []);

  return {
    // État des dossiers
    folders,
    currentFolder,
    foldersLoading,
    folderStats,
    
    // État des messages
    messages,
    selectedMessage,
    messagesLoading,
    messageLoading,
    
    // Pagination
    pagination,
    
    // Recherche
    searchQuery,
    
    // Sélection
    selectedIds,
    
    // Stats
    unreadCount,
    
    // Erreurs
    error,
    
    // Actions dossiers
    loadFolders,
    changeFolder,
    
    // Actions messages
    loadMessages,
    loadMessage,
    sendMessage,
    saveDraft,
    
    // Actions flags
    markAsRead,
    markAsUnread,
    toggleFlag,
    
    // Actions déplacement/suppression
    moveMessages,
    deleteMessages,
    
    // Actions sélection
    toggleSelection,
    selectAll,
    deselectAll,
    setSelectedMessage,
    
    // Recherche & pagination
    search,
    goToPage,
    
    // Utilitaires
    clearError: () => setError(null),
    refresh: () => loadMessages(currentFolder, pagination.page, searchQuery)
  };
};

export default useWebmail;