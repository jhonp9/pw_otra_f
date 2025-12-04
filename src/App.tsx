import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './componentes/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

// Páginas
import Inicio from './paginas/Inicio';
import Nosotros from './paginas/Nosotros';
import TyC from './paginas/TyC';
import Login from './paginas/Login';
import Registro from './paginas/Registro';
import DashboardUnificado from './paginas/DashUnificado';
import StreamRoom from './paginas/StreamRoom';
import ConfigUsuario from './paginas/ConfigUsuario';
import type { JSX } from 'react';

// Componente para proteger rutas privadas
const RutaPrivada = ({ children }: { children: JSX.Element }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="loading-screen">Cargando...</div>;
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <div className="app-layout">
        <Navbar />
        <div className="main-content">
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/" element={<Inicio />} />
            <Route path="/nosotros" element={<Nosotros />} />
            <Route path="/tyc" element={<TyC />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            
            {/* Rutas Privadas (Requieren Login) */}
            <Route path="/dashboard" element={
              <RutaPrivada>
                <DashboardUnificado />
              </RutaPrivada>
            } />
            <Route path="/configuracion" element={
              <RutaPrivada>
                <ConfigUsuario />
              </RutaPrivada>
            } />
            
            {/* Ruta Dinámica de Stream */}
            <Route path="/stream/:id" element={<StreamRoom />} />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
}

export default App;