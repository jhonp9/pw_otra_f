import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../servicios/api';
import MiModal from '../componentes/MiModal';

const Registro = () => {
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '', rol: 'espectador' });
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', success: false });
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/register', formData);
      
      if (res.userId) {
        setModal({ isOpen: true, title: '¡Bienvenido!', message: 'Cuenta creada exitosamente.', success: true });
      } else {
        setModal({ isOpen: true, title: 'Error', message: res.msg || 'Error al registrar', success: false });
      }
    } catch (error) {
      setModal({ isOpen: true, title: 'Error', message: 'Fallo en la conexión.', success: false });
    }
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.success) navigate('/login');
  };

  return (
    <div className="container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh'}}>
      <MiModal isOpen={modal.isOpen} onClose={closeModal} type="alert" title={modal.title} message={modal.message} />

      <div className="auth-box">
        <h2 className="text-center mb-20 text-neon">CREAR CUENTA</h2>
        <form onSubmit={handleRegister}>
          <input 
            type="text" placeholder="Nombre de Usuario" className="auth-input" required
            onChange={e => setFormData({...formData, nombre: e.target.value})}
          />
          <input 
            type="email" placeholder="Correo Electrónico" className="auth-input" required
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
          <input 
            type="password" placeholder="Contraseña" className="auth-input" required
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
          
          <label className="text-muted text-small">Quiero ser:</label>
          <select 
            className="auth-input" 
            onChange={e => setFormData({...formData, rol: e.target.value})}
            value={formData.rol}
          >
            <option value="espectador">Espectador (Ver y regalar)</option>
            <option value="streamer">Streamer (Transmitir)</option>
          </select>

          <button type="submit" className="btn-neon w-100 mt-20">REGISTRARSE</button>
        </form>
        <p className="text-center mt-20 text-muted">
          ¿Ya tienes cuenta? <Link to="/login" className="text-neon bold">Inicia Sesión</Link>
        </p>
      </div>
    </div>
  );
};

export default Registro;