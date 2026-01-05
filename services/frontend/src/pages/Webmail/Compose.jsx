// services/frontend/src/pages/Webmail/Compose.jsx
import React, { useState, useEffect, useRef } from 'react';
import RichTextEditor from '../../components/Email/RichTextEditor';
import RecipientInput from '../../components/Email/RecipientInput';
import { emailApi } from '../../services/emailApi';

const Compose = ({ replyTo, onCancel, onSendSuccess }) => {
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState(null);
  
  const fileInputRef = useRef(null);
  
  // Pré-remplir si c'est une réponse ou un transfert
  useEffect(() => {
    if (replyTo) {
      if (replyTo.forward) {
        // Transfert
        setSubject(
          replyTo.subject?.startsWith('Fwd:') 
            ? replyTo.subject 
            : `Fwd: ${replyTo.subject || ''}`
        );
        setHtml(`
          <br><br>
          <div style="border-left: 3px solid #ccc; padding-left: 10px; color: #666;">
            <p><strong>---------- Message transféré ----------</strong></p>
            <p><strong>De:</strong> ${replyTo.from?.[0]?.address || ''}</p>
            <p><strong>Date:</strong> ${new Date(replyTo.date).toLocaleString('fr-FR')}</p>
            <p><strong>Objet:</strong> ${replyTo.subject || ''}</p>
            <br>
            ${replyTo.html || replyTo.text?.replace(/\n/g, '<br>') || ''}
          </div>
        `);
      } else {
        // Réponse
        const fromAddress = replyTo.from?.[0]?.address;
        if (fromAddress) {
          setTo([fromAddress]);
        }
        
        // Répondre à tous : ajouter les autres destinataires en CC
        if (replyTo.replyAll && replyTo.to) {
          const otherRecipients = replyTo.to
            .map(r => r.address)
            .filter(addr => addr !== fromAddress);
          if (otherRecipients.length > 0) {
            setCc(otherRecipients);
            setShowCc(true);
          }
        }
        
        setSubject(
          replyTo.subject?.startsWith('Re:') 
            ? replyTo.subject 
            : `Re: ${replyTo.subject || ''}`
        );
        
        const quotedText = `
          <br><br>
          <div style="border-left: 3px solid #ccc; padding-left: 10px; color: #666;">
            <p><strong>Le ${new Date(replyTo.date).toLocaleString('fr-FR')}, ${replyTo.from?.[0]?.name || replyTo.from?.[0]?.address || ''} a écrit :</strong></p>
            ${replyTo.html || replyTo.text?.replace(/\n/g, '<br>') || ''}
          </div>
        `;
        setHtml(quotedText);
      }
    }
  }, [replyTo]);
  
  const handleSend = async () => {
    setError(null);
    
    // Validation
    if (to.length === 0) {
      setError('Veuillez saisir au moins un destinataire');
      return;
    }
    
    if (!subject.trim()) {
      if (!window.confirm('Envoyer sans objet ?')) {
        return;
      }
    }
    
    setSending(true);
    
    try {
      const messageData = {
        to: to.join(', '),
        cc: cc.length > 0 ? cc.join(', ') : undefined,
        bcc: bcc.length > 0 ? bcc.join(', ') : undefined,
        subject,
        html,
        attachments: attachments.map(a => ({
          filename: a.name,
          content: a.base64,
          contentType: a.type
        }))
      };
      
      await emailApi.sendMessage(messageData);
      onSendSuccess();
    } catch (error) {
      console.error('Erreur envoi:', error);
      setError(error.response?.data?.message || 'Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
    }
  };
  
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    
    try {
      await emailApi.saveDraft({
        to: to.join(', '),
        cc: cc.length > 0 ? cc.join(', ') : undefined,
        bcc: bcc.length > 0 ? bcc.join(', ') : undefined,
        subject,
        html,
        attachments: attachments.map(a => ({
          filename: a.name,
          content: a.base64,
          contentType: a.type
        }))
      });
      
      // Afficher une notification de succès
      alert('Brouillon enregistré');
    } catch (error) {
      console.error('Erreur sauvegarde brouillon:', error);
      setError('Erreur lors de la sauvegarde du brouillon');
    } finally {
      setSavingDraft(false);
    }
  };
  
  const handleAttachment = (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type,
          size: file.size,
          base64
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b px-6 py-3 flex items-center gap-2 bg-gray-50">
        <button
          onClick={handleSend}
          disabled={sending}
          className="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
        >
          {sending ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Envoi...</span>
            </>
          ) : (
            <>
              <span>📤</span>
              <span>Envoyer</span>
            </>
          )}
        </button>
        
        <button
          onClick={handleSaveDraft}
          disabled={savingDraft}
          className="px-3 py-1.5 border rounded hover:bg-white transition"
        >
          {savingDraft ? 'Sauvegarde...' : '💾 Brouillon'}
        </button>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 border rounded hover:bg-white transition"
        >
          📎 Joindre
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleAttachment}
          className="hidden"
        />
        
        <div className="flex-1"></div>
        
        <button
          onClick={onCancel}
          className="px-3 py-1.5 border rounded hover:bg-white transition text-gray-600"
        >
          ✕ Annuler
        </button>
      </div>
      
      {/* Message d'erreur */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      
      {/* Champs */}
      <div className="border-b px-6 py-4 space-y-3">
        {/* À */}
        <div className="flex items-center gap-2">
          <label className="font-semibold w-12 text-gray-600">À:</label>
          <div className="flex-1">
            <RecipientInput
              value={to}
              onChange={setTo}
              placeholder="destinataire@mssante.fr"
            />
          </div>
          <div className="flex gap-2 text-sm">
            {!showCc && (
              <button
                onClick={() => setShowCc(true)}
                className="text-blue-600 hover:underline"
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                onClick={() => setShowBcc(true)}
                className="text-blue-600 hover:underline"
              >
                Cci
              </button>
            )}
          </div>
        </div>
        
        {/* Cc */}
        {showCc && (
          <div className="flex items-center gap-2">
            <label className="font-semibold w-12 text-gray-600">Cc:</label>
            <div className="flex-1">
              <RecipientInput
                value={cc}
                onChange={setCc}
                placeholder="copie@mssante.fr"
              />
            </div>
            <button
              onClick={() => {
                setShowCc(false);
                setCc([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Bcc */}
        {showBcc && (
          <div className="flex items-center gap-2">
            <label className="font-semibold w-12 text-gray-600">Cci:</label>
            <div className="flex-1">
              <RecipientInput
                value={bcc}
                onChange={setBcc}
                placeholder="copie-cachee@mssante.fr"
              />
            </div>
            <button
              onClick={() => {
                setShowBcc(false);
                setBcc([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Objet */}
        <div className="flex items-center gap-2">
          <label className="font-semibold w-12 text-gray-600">Objet:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Objet du message..."
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Pièces jointes */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-gray-100 rounded px-3 py-1 text-sm"
              >
                <span>📎</span>
                <span className="truncate max-w-[200px]">{file.name}</span>
                <span className="text-gray-500">({formatSize(file.size)})</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Éditeur */}
      <div className="flex-1 overflow-y-auto p-4">
        <RichTextEditor
          value={html}
          onChange={setHtml}
        />
      </div>
    </div>
  );
};

export default Compose;