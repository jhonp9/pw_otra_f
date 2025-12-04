import { Link } from 'react-router-dom';

const TyC = () => {
  return (
    <div className="container">
      <h1 className="section-title">Términos y Condiciones</h1>
      
      <div className="form-box">
        {/* Placeholder de imagen solicitado */}
        <div className="tyc-placeholder">
          <div style={{textAlign: 'center'}}>
            <span style={{fontSize: '3rem'}}>📜</span>
            <p className="text-muted">Políticas de Uso StreamZone</p>
          </div>
        </div>

        <div className="tyc-content text-muted">
          <h3 className="text-white">1. Uso Aceptable</h3>
          <p>El respeto es fundamental. No se tolerará el acoso, discurso de odio o contenido ilegal en las transmisiones ni en el chat.</p>
          
          <h3 className="text-white mt-20">2. Monedas y Pagos</h3>
          <p>Las monedas adquiridas no son reembolsables. Asegúrate de verificar los montos antes de realizar compras o donaciones.</p>
          
          <h3 className="text-white mt-20">3. Propiedad Intelectual</h3>
          <p>Los streamers son responsables del contenido que transmiten. StreamZone respeta los derechos de autor y eliminará contenido infractor.</p>
        </div>
      </div>

      <div className="text-center mt-40">
        <Link to="/"><button className="btn-regresar">Regresar</button></Link>
      </div>
    </div>
  );
};

export default TyC;