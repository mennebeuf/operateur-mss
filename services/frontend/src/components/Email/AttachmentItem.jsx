// services/frontend/src/components/Email/AttachmentItem.jsx
import React, { useState } from 'react';
import { emailApi } from '../../services/emailApi';

const AttachmentItem = ({ attachment, messageUid, folder = 'INBOX', onRemove, isEditable = false }) => {
  const [downloading, setDownloading] = useState(false);

  // Déterminer l'icône selon le type MIME
  const getIcon = () => {
    const type = attachment.contentType || attachment.type || '';
    
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📕';
    if (type.includes('word') || type.includes('document')) return '📘';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📗';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📙';
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return '📦';
    if (type.includes('text')) return '📄';
    return '📎';
  };

  // Formater la taille du fichier
  const formatSize = (bytes) => {
    if (!bytes) return '';
    
    const units = ['o', 'Ko', 'Mo', 'Go'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  };

  // Télécharger la pièce jointe
  const handleDownload = async () => {
    if (!messageUid || isEditable) return;
    
    setDownloading(true);
    
    try {
      const response = await emailApi.downloadAttachment(
        messageUid,
        attachment.partId || attachment.id,
        folder
      );
      
      // Créer un lien de téléchargement
      const blob = new Blob([response.data], { type: attachment.contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename || attachment.name || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      alert('Erreur lors du téléchargement de la pièce jointe');
    } finally {
      setDownloading(false);
    }
  };

  // Supprimer (mode édition uniquement)
  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove?.(attachment);
  };

  return (
    <div
      onClick={handleDownload}
      className={`
        inline-flex items-center gap-2 px-3 py-2 
        bg-gray-100 hover:bg-gray-200 
        rounded-lg border border-gray-200
        transition-colors
        ${!isEditable && messageUid ? 'cursor-pointer' : 'cursor-default'}
        ${downloading ? 'opacity-50' : ''}
      `}
      title={isEditable ? attachment.filename : 'Cliquez pour télécharger'}
    >
      {/* Icône */}
      <span className="text-lg flex-shrink-0">
        {downloading ? '⏳' : getIcon()}
      </span>

      {/* Infos fichier */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate max-w-[150px]">
          {attachment.filename || attachment.name || 'Fichier'}
        </div>
        {attachment.size && (
          <div className="text-xs text-gray-500">
            {formatSize(attachment.size)}
          </div>
        )}
      </div>

      {/* Bouton supprimer (mode édition) */}
      {isEditable && onRemove && (
        <button
          onClick={handleRemove}
          className="text-gray-400 hover:text-red-600 transition-colors ml-1"
          title="Supprimer"
        >
          ✕
        </button>
      )}

      {/* Indicateur téléchargement */}
      {!isEditable && messageUid && !downloading && (
        <span className="text-gray-400 text-xs">⬇️</span>
      )}
    </div>
  );
};

export default AttachmentItem;