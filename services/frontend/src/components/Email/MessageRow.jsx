// services/frontend/src/components/Email/MessageRow.jsx
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const MessageRow = ({ message, isSelected, onClick, onDelete, onToggleFlag, onToggleRead }) => {
  const getFrom = () => {
    if (message.from && message.from.length > 0) {
      return message.from[0].name || message.from[0].address;
    }
    return '(inconnu)';
  };

  const formatDate = (date) => {
    try {
      return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: fr
      });
    } catch {
      return '';
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete?.();
  };

  const handleToggleFlag = (e) => {
    e.stopPropagation();
    onToggleFlag?.();
  };

  const handleToggleRead = (e) => {
    e.stopPropagation();
    onToggleRead?.();
  };

  return (
    <div
      onClick={onClick}
      className={`group p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : 'border-l-4 border-transparent'
      } ${!message.isRead ? 'bg-blue-50/30' : ''}`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Indicateurs */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!message.isRead && (
              <span 
                className="w-2 h-2 bg-blue-600 rounded-full" 
                title="Non lu"
              />
            )}
            {message.hasAttachments && (
              <span title="Pièces jointes" className="text-sm">📎</span>
            )}
            <button
              onClick={handleToggleFlag}
              title={message.isFlagged ? 'Retirer le marqueur' : 'Marquer'}
              className="text-sm hover:scale-110 transition-transform"
            >
              {message.isFlagged ? '⭐' : '☆'}
            </button>
          </div>

          {/* Expéditeur */}
          <span className={`truncate ${!message.isRead ? 'font-semibold' : ''}`}>
            {getFrom()}
          </span>
        </div>

        {/* Date */}
        <span className="text-xs text-gray-500 ml-2 whitespace-nowrap flex-shrink-0">
          {formatDate(message.date)}
        </span>
      </div>

      {/* Sujet */}
      <div className={`text-sm mb-1 truncate ${!message.isRead ? 'font-semibold' : ''}`}>
        {message.subject || '(sans objet)'}
      </div>

      {/* Preview */}
      <div className="text-xs text-gray-500 truncate">
        {message.preview || message.text?.substring(0, 100)}
      </div>

      {/* Actions rapides (visibles au hover) */}
      <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleToggleRead}
          className="text-xs text-gray-600 hover:text-blue-600 hover:underline"
        >
          {message.isRead ? 'Marquer non lu' : 'Marquer lu'}
        </button>
        <button
          onClick={handleDelete}
          className="text-xs text-red-600 hover:underline"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
};

export default MessageRow;