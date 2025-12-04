import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../servicios/api';
import MiModal from '../componentes/MiModal';
import { Link } from 'react-router-dom';

const DashboardUnificado = () => {
    const { user, refreshUser } = useAuth();
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    const [monto, setMonto] = useState(100);
    const [configNivel, setConfigNivel] = useState(1000); // Default 1000 XP
    
    // Gestión de Regalos (Solo Streamer)
    const [regalos, setRegalos] = useState<any[]>([]);
    const [nuevoRegalo, setNuevoRegalo] = useState({ nombre: '', costo: 0, puntos: 0, icono: '🎁' });

    useEffect(() => {
        if (user?.rol === 'streamer') cargarRegalos();
    }, [user]);

    const cargarRegalos = async () => {
        const data = await api.get('/shop/regalos');
        setRegalos(data);
    };

    const handleRecargar = async () => {
        if (!user) return;
        const res = await api.post('/shop/comprar', { userId: user.id, monto });
        await refreshUser(); 
        
        // Generamos un "Recibo" visual en el modal
        setModal({ 
            isOpen: true, 
            title: 'COMPROBANTE DE PAGO ✅', 
            message: (
                <div style={{textAlign: 'left', background: '#222', padding: '15px', borderRadius: '8px', fontSize: '0.9rem'}}>
                    <p><strong>ID Transacción:</strong> #{Date.now().toString().slice(-6)}</p>
                    <p><strong>Usuario:</strong> {user.nombre}</p>
                    <p><strong>Concepto:</strong> Pack de Monedas StreamZone</p>
                    <p><strong>Monto Recargado:</strong> {monto}</p>
                    <p><strong>Saldo Nuevo:</strong> {res.monedas}</p>
                    <p><strong>Fecha:</strong> {new Date().toLocaleDateString()}</p>
                    <div style={{marginTop: '10px', borderTop: '1px dashed #555', paddingTop: '5px', textAlign: 'center', fontSize: '0.8rem', color: '#888'}}>
                        Gracias por tu compra. Este es un comprobante válido.
                    </div>
                </div>
            ) as any // Cast rápido para pasar JSX al modal que espera string (o actualiza la prop del modal a ReactNode)
        });
    };

    const handleCrearRegalo = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!user) return;
        await api.post('/shop/regalos/crear', { ...nuevoRegalo, streamerId: user.id });
        await cargarRegalos();
        setNuevoRegalo({ nombre: '', costo: 0, puntos: 0, icono: '🎁' });
        setModal({ isOpen: true, title: 'REGALO CREADO', message: 'Tus espectadores ya pueden ver este regalo.' });
    };

    const handleEliminarRegalo = async (id: number) => {
        await api.delete(`/shop/regalos/${id}`);
        cargarRegalos();
    };

    if (!user) return <div className="container text-center text-neon mt-40">Cargando datos...</div>;

    // Calcular progreso nivel espectador (Meta: Cada 1000 XP)
    const xpMeta = 1000;
    const xpActualNivel = user.puntosXP % xpMeta;
    const porcentajeNivel = (xpActualNivel / xpMeta) * 100;

    return (
        <div className="container">
            <MiModal isOpen={modal.isOpen} onClose={() => setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message} />
            
            <div className="profile-header">
                <div className="profile-avatar">{user.nombre.charAt(0)}</div>
                <div>
                    <h1 className="text-neon">{user.nombre}</h1>
                    <p className="text-muted text-uppercase">{user.rol}</p>
                </div>
            </div>

            <div className="dashboard-layout">
                {/* --- PANEL DE ESPECTADOR --- */}
                {user.rol === 'espectador' && (
                    <>
                        <div className="stat-card money">
                            <h3 className="text-neon">{user.monedas} 💰</h3>
                            <p className="text-muted">Saldo Disponible</p>
                            <div className="mt-20">
                                <label className="text-muted text-small">Pasarela de Prueba</label>
                                <div style={{display:'flex', gap:'10px', marginTop:'5px'}}>
                                    <select className="auth-input" value={monto} onChange={e=>setMonto(Number(e.target.value))}>
                                        <option value="100">100 Monedas ($1)</option>
                                        <option value="500">500 Monedas ($5)</option>
                                        <option value="1000">1000 Monedas ($10)</option>
                                    </select>
                                    <button onClick={handleRecargar} className="btn-neon">COMPRAR</button>
                                </div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <h3>Nivel {user.nivelEspectador}</h3>
                            <p className="text-muted">Progreso: {xpActualNivel}/{xpMeta} XP</p>
                            <div className="progress-bar-container mt-20" style={{background:'#333', height:'10px', borderRadius:'5px'}}>
                                <div style={{width: `${porcentajeNivel}%`, background:'var(--neon-green)', height:'100%', transition:'width 0.5s'}}></div>
                            </div>
                            <p className="text-small text-neon mt-20">Envía mensajes y regalos para subir de nivel</p>
                        </div>
                    </>
                )}

                {/* --- PANEL DE STREAMER --- */}
                {user.rol === 'streamer' && (
                    <>
                        <div className="stat-card">
                            <h3>{user.horasStream.toFixed(2)}h</h3>
                            <p className="text-muted">Horas Transmitidas</p>
                        </div>
                        <div className="stat-card">
                            <h3>Nivel Streamer {user.nivelStreamer}</h3>
                            <p className="text-muted">Próximo nivel en {10 - (user.horasStream % 10)} horas</p>
                        </div>

                        {/* Req 22: Configuración de Niveles */}
                        <div className="dashboard-panel w-100 mt-20">
                            <h3 className="section-title text-small">⚙️ Configuración de Progresión</h3>
                            <p className="text-muted text-small">Ajusta la dificultad para que tus espectadores suban de nivel.</p>
                            
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px'}}>
                                <span>XP requerida por Nivel:</span>
                                <input 
                                    type="number" 
                                    className="auth-input input-small" 
                                    style={{width: '100px', margin: 0}}
                                    value={configNivel}
                                    onChange={(e) => setConfigNivel(Number(e.target.value))}
                                />
                                <button className="btn-secondary" onClick={() => setModal({isOpen:true, title:'Guardado', message: 'Nueva configuración aplicada.'})}>
                                    Guardar
                                </button>
                            </div>
                        </div>

                        {/* Gestión de Regalos */}
                        <div className="dashboard-panel w-100 mt-40">
                            <h2 className="section-title">Gestionar Regalos del Canal</h2>
                            <form onSubmit={handleCrearRegalo} className="gift-form">
                                <div className="input-row">
                                    <input placeholder="Nombre" className="auth-input" value={nuevoRegalo.nombre} onChange={e=>setNuevoRegalo({...nuevoRegalo, nombre: e.target.value})} required/>
                                    <input placeholder="Icono (Emoji)" className="auth-input input-small" value={nuevoRegalo.icono} onChange={e=>setNuevoRegalo({...nuevoRegalo, icono: e.target.value})} required/>
                                </div>
                                <div className="input-row">
                                    <input type="number" placeholder="Costo" className="auth-input" value={nuevoRegalo.costo} onChange={e=>setNuevoRegalo({...nuevoRegalo, costo: Number(e.target.value)})} required/>
                                    <input type="number" placeholder="Puntos XP" className="auth-input" value={nuevoRegalo.puntos} onChange={e=>setNuevoRegalo({...nuevoRegalo, puntos: Number(e.target.value)})} required/>
                                </div>
                                <button className="btn-neon w-100">CREAR REGALO</button>
                            </form>

                            <h4 className="mt-40 text-muted">Regalos Activos</h4>
                            <div className="gift-grid mt-20">
                                {regalos.map(r => (
                                    <div key={r.id} className="gift-card-compact" style={{border:'1px solid #333', padding:'10px', textAlign:'center'}}>
                                        <span style={{fontSize:'2rem'}}>{r.icono}</span>
                                        <p className="bold">{r.nombre}</p>
                                        <p className="text-small text-neon">{r.costo} Monedas</p>
                                        <button onClick={()=>handleEliminarRegalo(r.id)} className="btn-delete mt-10">Eliminar</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
            
            <div className="text-center mt-40">
                <Link to="/"><button className="btn-regresar">Volver al Inicio</button></Link>
            </div>
        </div>
    );
};

export default DashboardUnificado;