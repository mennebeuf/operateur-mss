// services/frontend/src/pages/Webmail/MessageView.jsx
import DOMPurify from 'dompurify';
import React from 'react';

import AttachmentItem from '../../components/Email/AttachmentItem';

const MessageView = ({ message, onReply, onReplyAll, onForward, onDelete }) => {
  const sanitizeHTML = html => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        'a',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'img',
        'table',
        'thead',
        'tbody',
        'tr',
        'td',
        'th',
        'div',
        'span',
        'blockquote'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style', 'class', 'target']
    });
  };

  const getFrom = () => {
    if (message.from && message.from.length > 0) {
      const from = message.from[0];
      return from.name ? `${from.name} <${from.address}>` : from.address;
    }
    return '(inconnu)';
  };

  const getRecipients = list => {
    if (!list || list.length === 0) {return '';}
    return list.map(r => (r.name ? `${r.name} <${r.address}>` : r.address)).join(', ');
  };

  const formatDate = date => {
    if (!date) {return '';}
    return new Date(date).toLocaleString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSize = bytes => {
    if (bytes < 1024) {return `${bytes} o`;}
    if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(1)} Ko`;}
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b px-6 py-3 flex items-center gap-2 bg-gray-50">
        <button
          onClick={onReply}
          className="px-3 py-1.5 border rounded hover:bg-white transition flex items-center gap-1"
          title="Répondre"
        >
          <span>↩️</span>
          <span>Répondre</span>
        </button>
        <button
          onClick={onReplyAll}
          className="px-3 py-1.5 border rounded hover:bg-white transition flex items-center gap-1"
          title="Répondre à tous"
        >
          <span>↩️</span>
          <span>Rép. tous</span>
        </button>
        <button
          onClick={onForward}
          className="px-3 py-1.5 border rounded hover:bg-white transition flex items-center gap-1"
          title="Transférer"
        >
          <span>➡️</span>
          <span>Transférer</span>
        </button>
        <div className="flex-1"></div>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 transition flex items-center gap-1"
          title="Supprimer"
        >
          <span>🗑️</span>
          <span>Supprimer</span>
        </button>
      </div>

      {/* En-tête du message */}
      <div className="border-b px-6 py-4">
        <h2 className="text-xl font-semibold mb-4">{message.subject || '(sans objet)'}</h2>

        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="font-semibold w-16 text-gray-600">De:</span>
            <span>{getFrom()}</span>
          </div>

          <div className="flex">
            <span className="font-semibold w-16 text-gray-600">À:</span>
            <span>{getRecipients(message.to)}</span>
          </div>

          {message.cc && message.cc.length > 0 && (
            <div className="flex">
              <span className="font-semibold w-16 text-gray-600">Cc:</span>
              <span>{getRecipients(message.cc)}</span>
            </div>
          )}

          <div className="flex">
            <span className="font-semibold w-16 text-gray-600">Date:</span>
            <span>{formatDate(message.date)}</span>
          </div>
        </div>
      </div>

      {/* Pièces jointes */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="border-b px-6 py-3 bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <span>📎</span>
            <span className="font-semibold text-sm">
              {message.attachments.length} pièce{message.attachments.length > 1 ? 's' : ''} jointe
              {message.attachments.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment, index) => (
              <AttachmentItem key={index} attachment={attachment} messageUid={message.uid} />
            ))}
          </div>
        </div>
      )}

      {/* Corps du message */}
      <div className="flex-1 overflow-y-auto p-6">
        {message.html ? (
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(message.html) }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-gray-800">{message.text}</pre>
        )}
      </div>
    </div>
  );
};

export default MessageView;
