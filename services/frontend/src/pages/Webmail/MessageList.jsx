// services/frontend/src/pages/Webmail/MessageList.jsx
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import React from 'react';

const MessageList = ({
  messages,
  selectedMessage,
  onSelectMessage,
  onDelete,
  onToggleRead,
  onToggleFlag,
  loading
}) => {
  const getFrom = message => {
    if (message.from && message.from.length > 0) {
      return message.from[0].name || message.from[0].address;
    }
    return '(inconnu)';
  };

  const formatDate = date => {
    if (!date) {
      return '';
    }
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: fr
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">📭</div>
          <div>Aucun message</div>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {messages.map(message => (
        <div
          key={message.uid}
          onClick={() => onSelectMessage(message)}
          className={`group p-4 cursor-pointer hover:bg-gray-50 transition ${
            selectedMessage?.uid === message.uid ? 'bg-blue-50 border-l-4 border-blue-600' : ''
          } ${!message.isRead ? 'bg-blue-50/30' : ''}`}
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Indicateurs */}
              <div className="flex gap-1 shrink-0">
                {!message.isRead && (
                  <span className="w-2 h-2 bg-blue-600 rounded-full" title="Non lu"></span>
                )}
                {message.hasAttachments && <span title="Pièces jointes">📎</span>}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onToggleFlag(message.uid, message.isFlagged);
                  }}
                  className={`hover:scale-110 transition ${
                    message.isFlagged ? '' : 'opacity-30 hover:opacity-100'
                  }`}
                  title={message.isFlagged ? 'Retirer le marqueur' : 'Marquer comme important'}
                >
                  ⭐
                </button>
              </div>

              {/* Expéditeur */}
              <span className={`truncate ${!message.isRead ? 'font-semibold' : ''}`}>
                {getFrom(message)}
              </span>
            </div>

            {/* Date */}
            <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
              {formatDate(message.date)}
            </span>
          </div>

          {/* Sujet */}
          <div className={`text-sm mb-1 truncate ${!message.isRead ? 'font-semibold' : ''}`}>
            {message.subject || '(sans objet)'}
          </div>

          {/* Aperçu */}
          <div className="text-xs text-gray-500 truncate">{message.preview}</div>

          {/* Actions rapides (au survol) */}
          <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={e => {
                e.stopPropagation();
                onToggleRead(message.uid, message.isRead);
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              {message.isRead ? 'Marquer non lu' : 'Marquer lu'}
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                onDelete([message.uid]);
              }}
              className="text-xs text-red-600 hover:underline"
            >
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageList;
