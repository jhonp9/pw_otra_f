import React from 'react';

interface ModalInfoProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  type?: 'success' | 'error' | 'info';
}

const ModalInfo: React.FC<ModalInfoProps> = ({ isOpen, onClose, title, message, type = 'info' }) => {
  if (!isOpen) return null;

  // Definir color del título según el tipo de mensaje
  const titleClass = type === 'error' ? 'text-red' : 'text-neon';

  return (
    <div className="modal-overlay">
      <div className="modal-box text-center" style={{ border: type === 'error' ? '2px solid #ff0000' : '2px solid #00ff41' }}>
        <button onClick={onClose} className="close-btn">✕</button>
        
        <h2 className={titleClass} style={{ fontSize: '1.8rem', marginTop: 0 }}>
          {title}
        </h2>
        
        <div className="text-muted" style={{ fontSize: '1.1rem', margin: '20px 0', lineHeight: '1.5' }}>
          {message}
        </div>
        
        <button onClick={onClose} className="btn-neon" style={{ minWidth: '150px' }}>
          ENTENDIDO
        </button>
      </div>
    </div>
  );
};

export default ModalInfo;