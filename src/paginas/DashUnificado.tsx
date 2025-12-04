// jhonp9/pw_otra_f/pw_otra_f-da43e77ca85f163b483dcad2d37ca90dd34b4584/src/paginas/DashUnificado.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../servicios/api';
import MiModal from '../componentes/MiModal';
import { Link, useNavigate } from 'react-router-dom';

const DashboardUnificado = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    const [monto, setMonto] = useState(100);
    const [showPayModal, setShowPayModal] = useState(false); // Modal Tarjeta
    const [tarjeta, setTarjeta] = useState({ num: '', cvc: '', exp: '' });
    
    // REQ 22: Estado para la meta de XP
    const [configNivel, setConfigNivel] = useState(1000); 
    
    // Gestión de Regalos
    const [regalos, setRegalos] = useState<any[]>([]);
    const [nuevoRegalo, setNuevoRegalo] = useState({ nombre: '', costo: 0, puntos: 0, icono: '🎁' });

    useEffect(() => {
        if (user?.rol === 'streamer') {
            cargarRegalos();
            if(user.metaXp) setConfigNivel(user.metaXp);
        }
    }, [user]);

    const cargarRegalos = async () => {
        const data = await api.get('/shop/regalos');
        setRegalos(data);
    };

    const handleGuardarConfig = async () => {
        if(!user) return;
        try {
            await api.put('/user/config', { userId: user.id, metaXp: configNivel });
            setModal({isOpen:true, title:'Guardado', message: 'Dificultad de nivel actualizada.'});
            refreshUser();
        } catch (error) {
            setModal({isOpen:true, title:'Error', message: 'No se pudo guardar la configuración.'});
        }
    };

    // REQ 23: Proceso de Pago Simulado
    const handleProcesarPago = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        // Simular espera
        setTimeout(async () => {
            const res = await api.post('/shop/comprar', { userId: user.id, monto });
            await refreshUser(); 
            setShowPayModal(false);
            setModal({ 
                isOpen: true, 
                title: '✅ PAGO EXITOSO', 
                message: `Se ha enviado un comprobante a ${user.email}. Tu nuevo saldo es: ${res.monedas}`
            });
            setTarjeta({ num: '', cvc: '', exp: '' });
        }, 1500);
    };

    const handleCrearRegalo = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!user) return;
        await api.post('/shop/regalos/crear', { ...nuevoRegalo, streamerId: user.id });
        await cargarRegalos();
        setNuevoRegalo({ nombre: '', costo: 0, puntos: 0, icono: '🎁' });
        setModal({ isOpen: true, title: 'REGALO CREADO', message: 'Disponible para tus espectadores.' });
    };

    const handleEliminarRegalo = async (id: number) => {
        await api.delete(`/shop/regalos/${id}`);
        cargarRegalos();
    };

    if (!user) return <div className="container text-center text-neon mt-40">Cargando...</div>;

    const xpMeta = user.metaXp || 1000;
    const xpActualNivel = user.puntosXP % xpMeta;
    const porcentajeNivel = (xpActualNivel / xpMeta) * 100;

    return (
        <div className="container">
            <MiModal isOpen={modal.isOpen} onClose={() => setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message} />
            
            {/* MODAL DE TARJETA DE CRÉDITO */}
            {showPayModal && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <button onClick={() => setShowPayModal(false)} className="close-btn">✕</button>
                        <h2 className="text-neon text-center">Pasarela de Pago Segura</h2>
                        <p className="text-center text-muted mb-20">Comprando {monto} monedas por ${(monto/100).toFixed(2)}</p>
                        <form onSubmit={handleProcesarPago}>
                            <input 
                                className="auth-input" placeholder="Número de Tarjeta (16 dígitos)" 
                                maxLength={16} required 
                                value={tarjeta.num} onChange={e=>setTarjeta({...tarjeta, num:e.target.value})}
                            />
                            <div style={{display:'flex', gap:'10px'}}>
                                <input className="auth-input" placeholder="MM/YY" required maxLength={5} value={tarjeta.exp} onChange={e=>setTarjeta({...tarjeta, exp:e.target.value})} />
                                <input className="auth-input" placeholder="CVC" required maxLength={3} value={tarjeta.cvc} onChange={e=>setTarjeta({...tarjeta, cvc:e.target.value})} />
                            </div>
                            <button className="btn-neon w-100 mt-20">PAGAR AHORA</button>
                        </form>
                        <p className="text-small text-center mt-10 text-muted">🔒 Encriptación de extremo a extremo</p>
                    </div>
                </div>
            )}

            <div className="profile-header">
                <div className="profile-avatar">{user.nombre.charAt(0)}</div>
                <div>
                    <h1 className="text-neon">{user.nombre}</h1>
                    <p className="text-muted text-uppercase">{user.rol}</p>
                </div>
            </div>

            <div className="dashboard-layout">
                {user.rol === 'espectador' && (
                    <>
                        <div className="stat-card money">
                            <h3 className="text-neon">{user.monedas} 💰</h3>
                            <p className="text-muted">Saldo Disponible</p>
                            <div className="mt-20">
                                <label className="text-muted text-small">Recargar Saldo</label>
                                <div style={{display:'flex', gap:'10px', marginTop:'5px', justifyContent:'center'}}>
                                    <select className="auth-input" style={{width:'auto'}} value={monto} onChange={e=>setMonto(Number(e.target.value))}>
                                        <option value="100">100 ($1)</option>
                                        <option value="500">500 ($5)</option>
                                        <option value="1000">1000 ($10)</option>
                                    </select>
                                    <button onClick={() => setShowPayModal(true)} className="btn-neon">COMPRAR</button>
                                </div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <h3>Nivel {user.nivelEspectador}</h3>
                            <p className="text-muted">Progreso: {xpActualNivel}/{xpMeta} XP</p>
                            <div className="progress-bar-container mt-20" style={{background:'#333', height:'10px', borderRadius:'5px', overflow:'hidden'}}>
                                <div style={{width: `${porcentajeNivel}%`, background:'var(--neon)', height:'100%', transition:'width 0.5s'}}></div>
                            </div>
                        </div>
                    </>
                )}

                {user.rol === 'streamer' && (
                    <>
                        <div className="stat-card" style={{gridColumn: '1 / -1', border: '2px solid var(--neon)'}}>
                            <h2 style={{marginTop:0}}>Panel de Control</h2>
                            <p className="text-muted mb-20">Gestiona tu transmisión y obtén horas.</p>
                            <button 
                                onClick={() => navigate(`/stream/${user.id}`)} 
                                className="btn-neon w-100" 
                                style={{fontSize: '1.2rem', padding: '15px'}}
                            >
                                📡 IR A MI SALA DE STREAM
                            </button>
                        </div>

                        <div className="stat-card">
                            <h3>{user.horasStream.toFixed(2)}h</h3>
                            <p className="text-muted">Horas Totales</p>
                        </div>
                        
                        <div className="stat-card">
                            <h3>Nivel Streamer {user.nivelStreamer}</h3>
                            <p className="text-muted text-small">Próximo nivel en {(10 - (user.horasStream % 10)).toFixed(1)} horas</p>
                            <div className="progress-bar-container mt-20" style={{background:'#333', height:'10px', borderRadius:'5px', overflow:'hidden'}}>
                                <div style={{width: `${(user.horasStream % 10) * 10}%`, background:'#ff0055', height:'100%', transition:'width 0.5s'}}></div>
                            </div>
                        </div>

                        <div className="dashboard-panel w-100 mt-20" style={{gridColumn: '1 / -1'}}>
                            <h3 className="section-title text-small">⚙️ Dificultad del Canal</h3>
                            <p className="text-muted text-small">Define cuántos XP necesitan tus viewers para subir de nivel.</p>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px'}}>
                                <span>XP por Nivel:</span>
                                <input 
                                    type="number" className="auth-input input-small" style={{width: '100px', margin: 0}}
                                    value={configNivel} onChange={(e) => setConfigNivel(Number(e.target.value))}
                                />
                                <button className="btn-secondary" onClick={handleGuardarConfig}>Guardar Config</button>
                            </div>
                        </div>

                        <div className="dashboard-panel w-100 mt-20" style={{gridColumn: '1 / -1'}}>
                            <h3 className="section-title">Gestionar Regalos</h3>
                            <form onSubmit={handleCrearRegalo} className="gift-form mt-20">
                                <div className="input-row" style={{display:'flex', gap:'10px'}}>
                                    <input placeholder="Nombre" className="auth-input" value={nuevoRegalo.nombre} onChange={e=>setNuevoRegalo({...nuevoRegalo, nombre: e.target.value})} required/>
                                    <input placeholder="Icono" className="auth-input" style={{width:'80px'}} value={nuevoRegalo.icono} onChange={e=>setNuevoRegalo({...nuevoRegalo, icono: e.target.value})} required/>
                                </div>
                                <div className="input-row" style={{display:'flex', gap:'10px'}}>
                                    <input type="number" placeholder="Costo" className="auth-input" value={nuevoRegalo.costo || ''} onChange={e=>setNuevoRegalo({...nuevoRegalo, costo: Number(e.target.value)})} required/>
                                    <input type="number" placeholder="Puntos XP" className="auth-input" value={nuevoRegalo.puntos || ''} onChange={e=>setNuevoRegalo({...nuevoRegalo, puntos: Number(e.target.value)})} required/>
                                </div>
                                <button className="btn-neon w-100 mt-10">CREAR +</button>
                            </form>

                            <div className="gift-grid mt-20">
                                {regalos.map(r => (
                                    <div key={r.id} className="gift-card-compact" style={{border:'1px solid #333', padding:'10px', textAlign:'center', borderRadius:'8px'}}>
                                        <span style={{fontSize:'2rem'}}>{r.icono}</span>
                                        <p className="bold" style={{margin:'5px 0'}}>{r.nombre}</p>
                                        <p className="text-small text-neon">{r.costo} Monedas</p>
                                        <button onClick={()=>handleEliminarRegalo(r.id)} className="btn-delete mt-10" style={{fontSize:'0.7rem'}}>Eliminar</button>
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