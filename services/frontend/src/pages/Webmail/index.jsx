// services/frontend/src/pages/Webmail/index.jsx
import React, { useState, useEffect, useCallback } from 'react';
import FolderTree from './FolderTree';
import MessageList from './MessageList';
import MessageView from './MessageView';
import Compose from './Compose';
import SearchBar from './SearchBar';
import { emailApi } from '../../services/emailApi';

const Webmail = () => {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Charger les dossiers
  const loadFolders = useCallback(async () => {
    try {
      const data = await emailApi.getFolders();
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Erreur chargement dossiers:', error);
    }
  }, []);

  // Charger les messages
  const loadMessages = useCallback(async (search = null) => {
    setLoading(true);
    try {
      const data = await emailApi.getMessages(selectedFolder, page, 50, search);
      setMessages(data.messages || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, page]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadMessages(searchQuery || null);
  }, [loadMessages, searchQuery]);

  // Sélectionner un message (charger le contenu complet)
  const handleSelectMessage = async (message) => {
    try {
      const fullMessage = await emailApi.getMessage(message.uid, selectedFolder);
      setSelectedMessage(fullMessage);
      setIsComposing(false);
      
      // Mettre à jour le flag "lu" dans la liste locale
      if (!message.isRead) {
        setMessages(prev => prev.map(m => 
          m.uid === message.uid ? { ...m, isRead: true } : m
        ));
      }
    } catch (error) {
      console.error('Erreur chargement message:', error);
    }
  };

  // Composer un nouveau message
  const handleCompose = () => {
    setSelectedMessage(null);
    setIsComposing(true);
  };

  // Répondre à un message
  const handleReply = (message, replyAll = false) => {
    setSelectedMessage({ ...message, replyAll });
    setIsComposing(true);
  };

  // Transférer un message
  const handleForward = (message) => {
    setSelectedMessage({ ...message, forward: true });
    setIsComposing(true);
  };

  // Supprimer des messages
  const handleDelete = async (uids) => {
    try {
      await emailApi.deleteMessages(selectedFolder, uids);
      setMessages(prev => prev.filter(m => !uids.includes(m.uid)));
      if (selectedMessage && uids.includes(selectedMessage.uid)) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  // Après envoi réussi
  const handleSendSuccess = () => {
    setIsComposing(false);
    setSelectedMessage(null);
    loadMessages();
  };

  // Recherche
  const handleSearch = (query) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Sélection de dossier
  const handleSelectFolder = (folder) => {
    setSelectedFolder(folder);
    setSelectedMessage(null);
    setPage(1);
    setSearchQuery('');
  };

  // Marquer comme lu/non lu
  const handleToggleRead = async (uid, isRead) => {
    try {
      await emailApi.setFlags(uid, selectedFolder, {
        [isRead ? 'remove' : 'add']: ['\\Seen']
      });
      setMessages(prev => prev.map(m => 
        m.uid === uid ? { ...m, isRead: !isRead } : m
      ));
    } catch (error) {
      console.error('Erreur modification flag:', error);
    }
  };

  // Marquer comme important
  const handleToggleFlag = async (uid, isFlagged) => {
    try {
      await emailApi.setFlags(uid, selectedFolder, {
        [isFlagged ? 'remove' : 'add']: ['\\Flagged']
      });
      setMessages(prev => prev.map(m => 
        m.uid === uid ? { ...m, isFlagged: !isFlagged } : m
      ));
    } catch (error) {
      console.error('Erreur modification flag:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Messagerie MSSanté</h1>
        
        <div className="flex items-center gap-4">
          <SearchBar onSearch={handleSearch} />
          
          <button
            onClick={handleCompose}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 transition"
          >
            <span>✉️</span>
            <span>Nouveau message</span>
          </button>
        </div>
      </div>
      
      {/* Corps principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Dossiers */}
        <div className="w-64 bg-gray-50 border-r overflow-y-auto">
          <FolderTree
            folders={folders}
            selectedFolder={selectedFolder}
            onSelectFolder={handleSelectFolder}
          />
        </div>
        
        {/* Liste des messages */}
        <div className="w-96 border-r overflow-y-auto bg-white">
          <MessageList
            messages={messages}
            selectedMessage={selectedMessage}
            onSelectMessage={handleSelectMessage}
            onDelete={handleDelete}
            onToggleRead={handleToggleRead}
            onToggleFlag={handleToggleFlag}
            loading={loading}
          />
          
          {/* Pagination */}
          {total > 50 && (
            <div className="p-4 border-t flex justify-between items-center bg-gray-50">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100 transition"
              >
                ← Précédent
              </button>
              <span className="text-sm text-gray-600">
                Page {page} / {Math.ceil(total / 50)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 50)}
                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100 transition"
              >
                Suivant →
              </button>
            </div>
          )}
        </div>
        
        {/* Visualisation ou Composition */}
        <div className="flex-1 overflow-y-auto bg-white">
          {isComposing ? (
            <Compose
              replyTo={selectedMessage}
              onCancel={() => setIsComposing(false)}
              onSendSuccess={handleSendSuccess}
            />
          ) : selectedMessage ? (
            <MessageView
              message={selectedMessage}
              onReply={() => handleReply(selectedMessage)}
              onReplyAll={() => handleReply(selectedMessage, true)}
              onForward={() => handleForward(selectedMessage)}
              onDelete={() => handleDelete([selectedMessage.uid])}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-6xl mb-4">📬</div>
                <div>Sélectionnez un message</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Webmail;