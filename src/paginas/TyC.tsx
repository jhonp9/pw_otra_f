// jhonp9/pw_otra_f/pw_otra_f-6420afd1c27951a0e347ec5e5f14f39cefa7bcce/src/paginas/TyC.tsx
import { Link } from 'react-router-dom';

const TyC = () => {
  return (
    <div className="container">
      <h1 className="section-title text-center text-neon">Términos y Condiciones</h1>
      
      <div className="form-box" style={{ maxWidth: '800px', margin: '0 auto', padding: '0', overflow: 'hidden' }}>
        {/* Imagen solicitada */}
        <div className="tyc-header" style={{ width: '100%', height: '250px', overflow: 'hidden' }}>
          <img 
            src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1000&auto=format&fit=crop" 
            alt="Legal" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div className="tyc-content text-muted" style={{ padding: '40px' }}>
          <h3 className="text-white">1. Uso Aceptable</h3>
          <p>Al usar StreamZone, aceptas mantener un ambiente de respeto. No se tolerará el acoso, discurso de odio o contenido ilegal en las transmisiones ni en el chat.</p>
          
          <h3 className="text-white mt-20">2. Monedas y Pagos</h3>
          <p>Las monedas adquiridas ("StreamCoins") no son reembolsables. Asegúrate de verificar los montos antes de realizar compras o donaciones a tus streamers favoritos.</p>
          
          <h3 className="text-white mt-20">3. Propiedad Intelectual</h3>
          <p>Los streamers son responsables del contenido que transmiten. StreamZone respeta los derechos de autor y eliminará contenido infractor bajo notificación.</p>
          
          <h3 className="text-white mt-20">4. Modificación de Niveles</h3>
          <p>La plataforma se reserva el derecho de ajustar la curva de experiencia para garantizar una competencia justa.</p>
        </div>
      </div>

      <div className="text-center mt-40">
        <Link to="/"><button className="btn-regresar">Regresar</button></Link>
      </div>
    </div>
  );
};

export default TyC;