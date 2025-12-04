import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: 'confirm' | 'alert'; // 'confirm' para borrar/decidir, 'alert' para avisos
  title: string;
  message: string;
  onConfirm?: () => void; // Solo para tipo 'confirm'
}

const MiModal = ({ isOpen, onClose, type, title, message, onConfirm }: Props) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box text-center" style={{borderColor: type === 'confirm' ? '#ff0000' : '#00ff41'}}>
        <button onClick={onClose} className="close-btn">✕</button>
        
        {/* Título dinámico: Rojo para peligro, Verde para éxito */}
        <h2 className={type === 'confirm' ? 'text-red' : 'text-neon'} style={{marginTop: 0}}>
          {title}
        </h2>
        
        <p className="text-muted" style={{fontSize: '1.1rem', margin: '20px 0'}}>
          {message}
        </p>
        
        {/* Botones Dinámicos */}
        <div style={{display: 'flex', gap: '15px', justifyContent: 'center'}}>
          {type === 'confirm' ? (
            <>
              <button onClick={onClose} className="btn-secondary">CANCELAR</button>
              <button 
                onClick={() => { onConfirm?.(); onClose(); }} 
                className="btn-delete"
                style={{width: 'auto', padding: '12px 24px'}}
              >
                SÍ, ELIMINAR
              </button>
            </>
          ) : (
            <button onClick={onClose} className="btn-neon" style={{width: 'auto', minWidth: '150px'}}>
              ENTENDIDO
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MiModal;