import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../servicios/api';
import MiModal from '../componentes/MiModal';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await api.post('/auth/login', { email, password });
      
      if (data.token) {
        login(data.token, data.user);
        navigate('/'); // Redirige al inicio
      } else {
        setModal({ isOpen: true, title: 'Error', message: data.msg || 'Credenciales incorrectas' });
      }
    } catch (error) {
      setModal({ isOpen: true, title: 'Error de Conexión', message: 'No se pudo conectar con el servidor.' });
    }
  };

  return (
    <div className="container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh'}}>
      <MiModal isOpen={modal.isOpen} onClose={() => setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message} />
      
      <div className="auth-box">
        <h2 className="text-center mb-20 text-neon">INICIAR SESIÓN</h2>
        <form onSubmit={handleLogin}>
          <input 
            type="email" placeholder="Email" className="auth-input" required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" placeholder="Contraseña" className="auth-input" required
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn-neon w-100 mt-20">ENTRAR</button>
        </form>
        <p className="text-center mt-20 text-muted">
          ¿Nuevo aquí? <Link to="/registro" className="text-neon bold">Regístrate</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;