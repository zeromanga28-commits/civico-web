import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import {
  collection, addDoc, getDocs, updateDoc, doc,
  serverTimestamp, query, orderBy, where
} from "firebase/firestore";
import L from "leaflet";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

// ── GOOGLE FONTS + ESTILOS GLOBAIS ────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap";
document.head.appendChild(fontLink);

const styleTag = document.createElement("style");
styleTag.textContent = `
  * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  body { margin: 0; font-family: 'Nunito', sans-serif; background: #F0F4FF; }
  @keyframes fadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse   { 0%,100%{opacity:1;} 50%{opacity:.45;} }
  .fadeIn  { animation: fadeIn  0.38s ease both; }
  .slideUp { animation: slideUp 0.44s cubic-bezier(.16,1,.3,1) both; }
  .card-hover { transition: transform 0.18s ease, box-shadow 0.18s ease; }
  .card-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(27,79,216,0.14) !important; }
  input:focus, select:focus, textarea:focus { border-color: #1B4FD8 !important; box-shadow: 0 0 0 3px rgba(27,79,216,0.11) !important; outline:none; }
  ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:#F1F5F9; } ::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:3px; }
`;
document.head.appendChild(styleTag);

// ── PALETA ────────────────────────────────────────────────────────────────
const C = {
  navy:"#0D1F4E", blue:"#1B4FD8", green:"#0A7C4E", amber:"#B45309",
  red:"#B91C1C", purple:"#7C3AED", teal:"#0E7490", slate:"#475569",
  bg:"#F0F4FF", card:"#FFFFFF", border:"#E2E8F0",
  muted:"#94A3B8", text:"#1E293B", sub:"#64748B",
};
const FF = "'Nunito', sans-serif";

const STATUS = {
  aberto:           { label:"Aberto",         emoji:"🔴", cor:C.red,    bg:"#FEE2E2" },
  "em analise":     { label:"Em análise",     emoji:"🔵", cor:C.blue,   bg:"#DBEAFE" },
  "em atendimento": { label:"Em atendimento", emoji:"🟡", cor:C.amber,  bg:"#FEF3C7" },
  resolvido:        { label:"Resolvido",      emoji:"🟢", cor:C.green,  bg:"#DCFCE7" },
  finalizado:       { label:"Finalizado",     emoji:"⚫", cor:C.slate,  bg:"#F1F5F9" },
};
const FLUXO = ["aberto","em analise","em atendimento","resolvido","finalizado"];
const CAT_COR = { buraco:C.red, iluminacao:C.amber, lixo:C.blue, calcada:C.purple, arvore:C.green, esgoto:C.teal, outro:C.slate };
const MESES   = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const inp = {
  width:"100%", padding:"13px 16px", borderRadius:12,
  border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:FF,
  marginBottom:12, boxSizing:"border-box", outline:"none",
  background:"white", color:C.text, fontWeight:600,
  WebkitAppearance:"none", touchAction:"manipulation",
  transition:"border-color 0.2s, box-shadow 0.2s",
};

// ── COMPONENTES ───────────────────────────────────────────────────────────
function Btn({ onClick, children, color="blue", disabled=false }) {
  const bg = {
    blue:  `linear-gradient(135deg,${C.navy},${C.blue})`,
    green: `linear-gradient(135deg,${C.green},#10B981)`,
    gray:  C.muted,
  };
  return (
    <button onPointerUp={() => { if(!disabled) onClick(); }} disabled={disabled}
      style={{ width:"100%", padding:"15px 20px", borderRadius:14, background:disabled?C.muted:bg[color],
        color:"white", fontSize:15, fontWeight:800, fontFamily:FF, border:"none",
        cursor:disabled?"not-allowed":"pointer", marginBottom:10,
        boxShadow:disabled?"none":"0 4px 18px rgba(27,79,216,0.22)",
        transition:"transform 0.1s, opacity 0.15s",
      }}
      onPointerDown={e => { if(!disabled) e.currentTarget.style.transform="scale(0.97)"; }}
      onPointerUp2={e => { e.currentTarget.style.transform="scale(1)"; }}
      onPointerLeave={e => { e.currentTarget.style.transform="scale(1)"; }}
    >{children}</button>
  );
}

function Card({ onClick, children, highlight=false, style={} }) {
  return (
    <div className={onClick?"card-hover":""} onPointerUp={() => onClick&&onClick()}
      style={{ background:C.card, borderRadius:20, padding:22,
        boxShadow:"0 2px 16px rgba(13,31,78,0.07)",
        cursor:onClick?"pointer":"default",
        border:highlight?`2px solid ${C.blue}`:`1.5px solid ${C.border}`,
        WebkitTapHighlightColor:"transparent", userSelect:"none", touchAction:"manipulation",
        ...style,
      }}
    >{children}</div>
  );
}

function Lnk({ onClick, children }) {
  return (
    <span onPointerUp={onClick}
      style={{ color:C.blue, fontWeight:800, cursor:"pointer", padding:"6px 4px", display:"inline-block", WebkitTapHighlightColor:"transparent" }}
    >{children}</span>
  );
}

function Badge({ status }) {
  const s = STATUS[status]||STATUS["aberto"];
  return <span style={{ background:s.bg, color:s.cor, fontSize:12, fontWeight:800, padding:"5px 12px", borderRadius:20, display:"inline-block", fontFamily:FF }}>{s.emoji} {s.label}</span>;
}

function Hdr({ titulo, sub, onVoltar, acoes }) {
  return (
    <div style={{ background:`linear-gradient(135deg,${C.navy} 0%,${C.blue} 100%)`, padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 4px 20px rgba(13,31,78,0.2)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {onVoltar && <button onPointerUp={onVoltar} style={{ background:"rgba(255,255,255,0.14)", border:"1.5px solid rgba(255,255,255,0.24)", color:"white", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:FF }}>← Voltar</button>}
        <div>
          <div style={{ fontSize:18, fontWeight:900, color:"white", fontFamily:FF }}>{titulo}</div>
          {sub && <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)", marginTop:1 }}>{sub}</div>}
        </div>
      </div>
      {acoes && <div style={{ display:"flex", gap:8 }}>{acoes}</div>}
    </div>
  );
}

function HdrBtn({ onClick, children }) {
  return <button onPointerUp={onClick} style={{ background:"rgba(255,255,255,0.14)", border:"1.5px solid rgba(255,255,255,0.24)", color:"white", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:FF }}>{children}</button>;
}

function Lbl({ children, sub }) {
  return <label style={{ fontSize:12, fontWeight:800, color:C.navy, display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>{children}{sub&&<span style={{ fontSize:11, color:C.muted, fontWeight:600, textTransform:"none", marginLeft:6 }}>{sub}</span>}</label>;
}

function Timeline({ historico }) {
  if (!historico||!historico.length) return null;
  return (
    <div style={{ marginTop:20 }}>
      <div style={{ fontSize:12, fontWeight:800, color:C.navy, marginBottom:12, textTransform:"uppercase", letterSpacing:0.8 }}>📋 Histórico</div>
      <div style={{ position:"relative", paddingLeft:22 }}>
        <div style={{ position:"absolute", left:7, top:4, bottom:4, width:2, background:C.border, borderRadius:2 }} />
        {historico.map((h,i) => {
          const s = STATUS[h.status]||STATUS["aberto"];
          return (
            <div key={i} style={{ position:"relative", marginBottom:16, animation:`fadeIn 0.3s ${i*0.07}s ease both` }}>
              <div style={{ position:"absolute", left:-22, top:3, width:14, height:14, borderRadius:"50%", background:s.cor, border:"2.5px solid white", boxShadow:`0 0 0 2px ${s.cor}` }} />
              <div style={{ fontSize:13, fontWeight:800, color:s.cor }}>{s.emoji} {s.label}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{h.criadoEm?.toDate?h.criadoEm.toDate().toLocaleString("pt-BR"):""}</div>
              {h.obs&&<div style={{ fontSize:12, color:C.sub, marginTop:3, background:"#F8FAFC", padding:"6px 10px", borderRadius:8, borderLeft:`3px solid ${s.cor}` }}>{h.obs}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UploadFoto({ foto, setFoto, preview, setPreview }) {
  function handle(e) {
    const f = e.target.files[0]; if(!f) return;
    if(!["image/jpeg","image/png"].includes(f.type)){alert("Apenas JPG e PNG.");return;}
    if(f.size>5*1024*1024){alert("Máximo 5MB.");return;}
    setFoto(f);
    const r=new FileReader(); r.onload=ev=>setPreview(ev.target.result); r.readAsDataURL(f);
  }
  return (
    <div style={{ marginBottom:18 }}>
      <Lbl sub="(opcional · JPG/PNG · máx 5MB)">📷 Foto</Lbl>
      {preview?(
        <div style={{ position:"relative" }}>
          <img src={preview} alt="preview" style={{ width:"100%", borderRadius:14, maxHeight:220, objectFit:"cover", border:`2px solid ${C.border}` }} />
          <button onClick={()=>{setFoto(null);setPreview(null);}} style={{ position:"absolute",top:10,right:10,background:C.red,color:"white",border:"none",borderRadius:"50%",width:30,height:30,cursor:"pointer",fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
        </div>
      ):(
        <label style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:8,border:`2px dashed ${C.border}`,borderRadius:14,padding:"28px 16px",textAlign:"center",cursor:"pointer",background:"#F8FAFF",transition:"border-color 0.2s,background 0.2s" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.background="#EEF3FE";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background="#F8FAFF";}}>
          <div style={{ fontSize:36 }}>📸</div>
          <div style={{ fontSize:14,color:C.sub,fontWeight:700 }}>Clique para adicionar uma foto</div>
          <div style={{ fontSize:12,color:C.muted }}>JPG ou PNG · máx 5MB</div>
          <input type="file" accept="image/jpeg,image/png" onChange={handle} style={{ display:"none" }} />
        </label>
      )}
    </div>
  );
}

function MapaChamados({ chamados }) {
  const mapRef=useRef(null), mapInst=useRef(null);
  useEffect(()=>{
    if(mapInst.current) return;
    mapInst.current=L.map(mapRef.current).setView([-15.78,-47.93],5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(mapInst.current);
    return()=>{ if(mapInst.current){mapInst.current.remove();mapInst.current=null;} };
  },[]);
  useEffect(()=>{
    if(!mapInst.current) return;
    mapInst.current.eachLayer(l=>{if(l instanceof L.Marker)l.remove();});
    const v=chamados.filter(c=>c.latitude&&c.longitude); if(!v.length) return;
    v.forEach(c=>{
      const cor=CAT_COR[c.categoria]||C.slate;
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.716 0 0 6.716 0 15c0 10 15 25 15 25s15-15 15-25C30 6.716 23.284 0 15 0z" fill="${cor}"/><circle cx="15" cy="15" r="7" fill="white" opacity="0.9"/></svg>`;
      const icon=L.divIcon({html:svg,className:"",iconSize:[30,40],iconAnchor:[15,40]});
      const s=STATUS[c.status]||STATUS["aberto"];
      const popup=`<div style="min-width:210px;font-family:${FF};padding:4px"><div style="font-weight:800;font-size:14px;color:${C.navy};margin-bottom:5px">${c.titulo}</div><div style="font-size:12px;color:${C.sub};margin-bottom:6px">${c.descricao}</div><span style="background:${s.bg};color:${s.cor};font-size:11px;font-weight:800;padding:3px 10px;border-radius:12px">${s.emoji} ${s.label}</span>${c.fotoURL?`<br/><img src="${c.fotoURL}" style="width:100%;border-radius:8px;margin-top:8px;max-height:120px;object-fit:cover"/>`:"" }</div>`;
      L.marker([c.latitude,c.longitude],{icon}).addTo(mapInst.current).bindPopup(popup);
    });
    mapInst.current.setView([v[0].latitude,v[0].longitude],13);
  },[chamados]);
  return(
    <div>
      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:14 }}>
        {Object.entries(CAT_COR).map(([cat,cor])=>(
          <span key={cat} style={{ background:cor+"18",color:cor,fontSize:11,fontWeight:800,padding:"4px 12px",borderRadius:20,border:`1.5px solid ${cor}33`,fontFamily:FF }}>● {cat}</span>
        ))}
      </div>
      <div ref={mapRef} style={{ width:"100%",height:460,borderRadius:18,overflow:"hidden",border:`2px solid ${C.border}`,boxShadow:"0 4px 20px rgba(0,0,0,0.06)" }} />
      {!chamados.filter(c=>c.latitude&&c.longitude).length&&<div style={{ textAlign:"center",color:C.muted,fontSize:13,marginTop:14 }}>Nenhum chamado com localização ainda.</div>}
    </div>
  );
}

function Empty() {
  return <div style={{ textAlign:"center",color:C.muted,padding:"36px 0",fontSize:14,fontFamily:FF }}>📭 Sem dados ainda</div>;
}

function Dashboard({ chamados }) {
  const porCat = Object.entries(chamados.reduce((a,c)=>{a[c.categoria]=(a[c.categoria]||0)+1;return a;},{})).map(([n,v])=>({name:n,value:v,fill:CAT_COR[n]||C.slate}));
  const porSt  = Object.entries(chamados.reduce((a,c)=>{a[c.status]=(a[c.status]||0)+1;return a;},{})).map(([n,v])=>({name:STATUS[n]?.label||n,value:v,fill:STATUS[n]?.cor||C.slate}));
  const porMes = chamados.reduce((a,c)=>{
    if(!c.criadoEm?.toDate) return a;
    const d=c.criadoEm.toDate(), k=`${MESES[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`;
    a[k]=(a[k]||0)+1; return a;
  },{});
  const dadosMes=Object.entries(porMes).slice(-6).map(([mes,total])=>({mes,total}));
  const resolvidos=chamados.filter(c=>(c.status==="resolvido"||c.status==="finalizado")&&c.criadoEm?.toDate);
  const tempoMedio=resolvidos.length>0?(resolvidos.reduce((a,c)=>a+(Date.now()-c.criadoEm.toDate().getTime())/86400000,0)/resolvidos.length).toFixed(1):null;
  const kpis=[
    {label:"Total",     valor:chamados.length,                                                                                 cor:C.blue,   emoji:"📋"},
    {label:"Em Aberto", valor:chamados.filter(c=>c.status==="aberto").length,                                                  cor:C.red,    emoji:"🔴"},
    {label:"Andamento", valor:chamados.filter(c=>c.status==="em analise"||c.status==="em atendimento").length,                 cor:C.amber,  emoji:"🟡"},
    {label:"Resolvidos",valor:chamados.filter(c=>c.status==="resolvido"||c.status==="finalizado").length,                      cor:C.green,  emoji:"🟢"},
    {label:"Tempo Méd.",valor:tempoMedio?`${tempoMedio}d`:"—",                                                                cor:C.purple, emoji:"⏱️"},
  ];
  const g={background:C.card,borderRadius:18,padding:"22px 20px",boxShadow:"0 2px 16px rgba(13,31,78,0.06)",marginBottom:18,border:`1.5px solid ${C.border}`};
  const tt={contentStyle:{borderRadius:10,fontFamily:FF,fontSize:13}};
  return(
    <div className="fadeIn">
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:20 }}>
        {kpis.map((k,i)=>(
          <div key={i} className="slideUp" style={{ background:C.card,borderRadius:16,padding:"16px 14px",boxShadow:"0 2px 14px rgba(13,31,78,0.07)",borderTop:`4px solid ${k.cor}`,animationDelay:`${i*0.06}s` }}>
            <div style={{ fontSize:26,marginBottom:6 }}>{k.emoji}</div>
            <div style={{ fontSize:28,fontWeight:900,color:k.cor,fontFamily:FF,lineHeight:1 }}>{k.valor}</div>
            <div style={{ fontSize:11,color:C.sub,marginTop:4,fontWeight:700,textTransform:"uppercase",letterSpacing:0.4 }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={g}>
        <div style={{ fontSize:14,fontWeight:800,color:C.navy,marginBottom:16,fontFamily:FF }}>📂 Ocorrências por Categoria</div>
        {!porCat.length?<Empty/>:(
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porCat} margin={{top:5,right:10,left:-20,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
              <XAxis dataKey="name" tick={{fontSize:11,fontFamily:FF}}/>
              <YAxis tick={{fontSize:11}} allowDecimals={false}/>
              <Tooltip {...tt}/>
              <Bar dataKey="value" name="Chamados" radius={[8,8,0,0]}>{porCat.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={g}>
        <div style={{ fontSize:14,fontWeight:800,color:C.navy,marginBottom:16,fontFamily:FF }}>📊 Ocorrências por Status</div>
        {!porSt.length?<Empty/>:(
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porSt} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {porSt.map((e,i)=><Cell key={i} fill={e.fill}/>)}
              </Pie>
              <Tooltip {...tt}/><Legend wrapperStyle={{fontFamily:FF,fontSize:12}}/>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={g}>
        <div style={{ fontSize:14,fontWeight:800,color:C.navy,marginBottom:16,fontFamily:FF }}>📅 Chamados por Mês</div>
        {!dadosMes.length?<Empty/>:(
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dadosMes} margin={{top:5,right:10,left:-20,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
              <XAxis dataKey="mes" tick={{fontSize:11,fontFamily:FF}}/>
              <YAxis tick={{fontSize:11}} allowDecimals={false}/>
              <Tooltip {...tt}/>
              <Line type="monotone" dataKey="total" name="Chamados" stroke={C.blue} strokeWidth={3} dot={{fill:C.blue,r:5}}/>
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Lightbox({ src, onClose }) {
  if(!src) return null;
  return(
    <div onClick={onClose} style={{ position:"fixed",top:0,left:0,width:"100vw",height:"100vh",background:"rgba(0,0,0,0.94)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out",animation:"fadeIn 0.2s ease" }}>
      <img src={src} alt="foto ampliada" onClick={e=>e.stopPropagation()} style={{ maxWidth:"94vw",maxHeight:"90vh",borderRadius:18,boxShadow:"0 16px 60px rgba(0,0,0,0.7)",objectFit:"contain" }}/>
      <button onClick={onClose} style={{ position:"fixed",top:20,right:20,background:"rgba(255,255,255,0.12)",border:"1.5px solid rgba(255,255,255,0.25)",color:"white",borderRadius:"50%",width:42,height:42,fontSize:22,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
    </div>
  );
}

async function uploadCloudinary(arquivo) {
  const fd=new FormData(); fd.append("file",arquivo); fd.append("upload_preset",CLOUDINARY_PRESET);
  const res=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,{method:"POST",body:fd});
  const data=await res.json(); if(!data.secure_url) throw new Error("Erro no upload"); return data.secure_url;
}

// ── APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [tela,setTela]                   = useState("login");
  const [tipoLogin,setTipoLogin]         = useState("cidadao");
  const [email,setEmail]                 = useState("");
  const [senha,setSenha]                 = useState("");
  const [erro,setErro]                   = useState("");
  const [usuario,setUsuario]             = useState(null);
  const [municipio,setMunicipio]         = useState(null);
  const [municipios,setMunicipios]       = useState([{ id:"maringa-pr", nome:"Maringá", estado:"PR", ativo:true, adminEmail:"prefeitura@civico.com" }]);
  const [municipioSel,setMunicipioSel]   = useState("");
  const [carregandoMun,setCarregandoMun] = useState(false);
  const [titulo,setTitulo]               = useState("");
  const [sugestoes,setSugestoes]         = useState([]);
  const [buscandoEnd,setBuscandoEnd]     = useState(false);
  const timeoutRef                       = useRef(null);
  const [descricao,setDescricao]         = useState("");
  const [categoria,setCategoria]         = useState("");
  const [foto,setFoto]                   = useState(null);
  const [preview,setPreview]             = useState(null);
  const [enviando,setEnviando]           = useState(false);
  const [sucesso,setSucesso]             = useState(false);
  const [localizacao,setLocalizacao]     = useState(null);
  const [chamados,setChamados]           = useState([]);
  const [meusChamados,setMeusChamados]   = useState([]);
  const [carregando,setCarregando]       = useState(false);
  const [chamadoDetalhe,setChamadoDetalhe]     = useState(null);
  const [historicoDetalhe,setHistoricoDetalhe] = useState([]);
  const [obsStatus,setObsStatus]         = useState("");
  const [abaPainel,setAbaPainel]         = useState("dashboard");
  const [fotoLightbox,setFotoLightbox]   = useState(null);
  const [mostrarSenha,setMostrarSenha]   = useState(false);
  const [lembrar,setLembrar]             = useState(false);

  useEffect(()=>{ const s=localStorage.getItem("civico_email"); if(s) setEmail(s); },[]);

  useEffect(()=>{ if(email) localStorage.setItem("civico_email",email); },[email]);

  useEffect(()=>{
    async function load(){
      setCarregandoMun(true);
      try{
        const q=query(collection(db,"municipios"),where("ativo","==",true));
        const snap=await getDocs(q);
        setMunicipios(snap.docs.map(d=>({id:d.id,...d.data()})));
      }catch(e){console.error(e);}
      setCarregandoMun(false);
    } load();
  },[]);

  async function entrar(){
    setErro(""); if(!municipioSel){setErro("Selecione sua cidade.");return;}
    try{
      const r=await signInWithEmailAndPassword(auth,email,senha);
      const mun=municipios.find(m=>m.id===municipioSel);
      const isAdmin=r.user.email===mun?.adminEmail;
      if(tipoLogin==="admin"&&!isAdmin){await signOut(auth);setErro("Acesso negado para este e-mail.");return;}
      if(tipoLogin==="cidadao"&&isAdmin){await signOut(auth);setErro("Use o acesso Administração.");return;}
      setUsuario(r.user); setMunicipio(mun); setTela(isAdmin?"painel":"home");
    }catch(e){setErro("E-mail ou senha incorretos.");}
  }

  async function cadastrar(){
    setErro(""); if(!municipioSel){setErro("Selecione sua cidade.");return;}
    if(!email||!senha){setErro("Preencha e-mail e senha.");return;}
    if(senha.length<6){setErro("Senha: mínimo 6 caracteres.");return;}
    try{
      const r=await createUserWithEmailAndPassword(auth,email,senha);
      setUsuario(r.user); setMunicipio(municipios.find(m=>m.id===municipioSel)); setTela("home");
    }catch(e){ if(e.code==="auth/email-already-in-use") setErro("E-mail já cadastrado."); else setErro("Erro ao cadastrar."); }
  }

  async function esqueceuSenha(){
    if(!email){setErro("Digite seu e-mail primeiro.");return;}
    try{await sendPasswordResetEmail(auth,email);alert("E-mail de redefinição enviado!");}catch(e){setErro("E-mail não encontrado.");}
  }

  async function sair(){ await signOut(auth); setUsuario(null);setEmail("");setSenha("");setMunicipio(null);setMunicipioSel("");setTela("login"); }

  function capturarLocalizacao(){
    if(!navigator.geolocation){alert("Dispositivo não suporta geolocalização.");return;}
    navigator.geolocation.getCurrentPosition(pos=>setLocalizacao({latitude:pos.coords.latitude,longitude:pos.coords.longitude}),()=>alert("Não foi possível obter localização."));
  }

  function buscarEndereco(texto){
    clearTimeout(timeoutRef.current); if(texto.length<4){setSugestoes([]);return;} setBuscandoEnd(true);
    timeoutRef.current=setTimeout(async()=>{
      try{ const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(texto+" "+(municipio?.nome||""))}&addressdetails=1`); const data=await res.json(); setSugestoes(data.map(d=>d.display_name)); }catch(e){setSugestoes([]);}
      setBuscandoEnd(false);
    },600);
  }

  async function enviarReporte(){
    if(!titulo||!descricao||!categoria){alert("Preencha todos os campos!");return;} setEnviando(true);
    try{
      let fotoURL=null; if(foto) fotoURL=await uploadCloudinary(foto);
      const ref=await addDoc(collection(db,"chamados"),{ titulo,descricao,categoria,status:"aberto",email:usuario.email,userId:usuario.uid,municipioId:municipio.id,municipioNome:municipio.nome,fotoURL:fotoURL||null,latitude:localizacao?.latitude||null,longitude:localizacao?.longitude||null,criadoEm:serverTimestamp() });
      await addDoc(collection(db,"chamados",ref.id,"historico"),{status:"aberto",obs:"Ocorrência registrada pelo cidadão.",criadoEm:serverTimestamp()});
      setSucesso(true); setTitulo("");setDescricao("");setCategoria("");setFoto(null);setPreview(null);setLocalizacao(null);
    }catch(e){alert("Erro ao enviar.");console.error(e);} setEnviando(false);
  }

  async function carregarMeusChamados(){
    if(!usuario) return; setCarregando(true);
    try{ const q=query(collection(db,"chamados"),where("userId","==",usuario.uid),orderBy("criadoEm","desc")); const snap=await getDocs(q); setMeusChamados(snap.docs.map(d=>({id:d.id,...d.data()}))); }catch(e){console.error(e);}
    setCarregando(false);
  }

  async function abrirDetalhe(chamado){
    setChamadoDetalhe(chamado);
    try{ const q=query(collection(db,"chamados",chamado.id,"historico"),orderBy("criadoEm","asc")); const snap=await getDocs(q); setHistoricoDetalhe(snap.docs.map(d=>d.data())); }catch(e){setHistoricoDetalhe([]);}
    setTela("detalhe");
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ if(tela==="meus-chamados") carregarMeusChamados(); },[tela]);

  async function carregarChamados(){
    if(!municipio) return; setCarregando(true);
    try{ const q=query(collection(db,"chamados"),where("municipioId","==",municipio.id),orderBy("criadoEm","desc")); const snap=await getDocs(q); setChamados(snap.docs.map(d=>({id:d.id,...d.data()}))); }catch(e){console.error(e);}
    setCarregando(false);
  }

  async function mudarStatus(id,novoStatus){
    try{ await updateDoc(doc(db,"chamados",id),{status:novoStatus}); await addDoc(collection(db,"chamados",id,"historico"),{status:novoStatus,obs:obsStatus||"",criadoEm:serverTimestamp()}); setObsStatus(""); carregarChamados(); }catch(e){alert("Erro ao atualizar status.");}
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ if(tela==="painel") carregarChamados(); },[tela]);

  // ── DETALHE ───────────────────────────────────────────────────────────────
  if(tela==="detalhe"&&chamadoDetalhe) return(
    <div className="fadeIn" style={{ minHeight:"100vh",background:C.bg,fontFamily:FF }}>
      <Hdr titulo="📋 Detalhe" sub={municipio?.nome} onVoltar={()=>setTela("meus-chamados")}/>
      <div style={{ padding:"20px 16px",maxWidth:600,margin:"0 auto" }}>
        <Card>
          <div style={{ marginBottom:14 }}><Badge status={chamadoDetalhe.status}/></div>
          <div style={{ fontSize:20,fontWeight:900,color:C.navy,marginBottom:8 }}>{chamadoDetalhe.titulo}</div>
          <div style={{ fontSize:14,color:C.sub,marginBottom:12,lineHeight:1.6 }}>{chamadoDetalhe.descricao}</div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:16 }}>
            <span style={{ fontSize:12,color:C.sub,background:C.bg,padding:"4px 10px",borderRadius:8,fontWeight:700 }}>📂 {chamadoDetalhe.categoria}</span>
            <span style={{ fontSize:12,color:C.sub,background:C.bg,padding:"4px 10px",borderRadius:8,fontWeight:700 }}>📅 {chamadoDetalhe.criadoEm?.toDate?chamadoDetalhe.criadoEm.toDate().toLocaleDateString("pt-BR"):""}</span>
            {chamadoDetalhe.latitude&&<span style={{ fontSize:12,color:C.green,background:"#DCFCE7",padding:"4px 10px",borderRadius:8,fontWeight:700 }}>📍 Localização</span>}
          </div>
          {chamadoDetalhe.fotoURL&&(
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12,fontWeight:800,color:C.navy,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5 }}>📷 Foto</div>
              <img src={chamadoDetalhe.fotoURL} alt="foto" style={{ width:"100%",borderRadius:14,maxHeight:260,objectFit:"cover" }}/>
            </div>
          )}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12,fontWeight:800,color:C.navy,marginBottom:10,textTransform:"uppercase",letterSpacing:0.5 }}>Progresso</div>
            <div style={{ display:"flex",gap:4 }}>
              {FLUXO.map((s,i)=>{
                const idx=FLUXO.indexOf(chamadoDetalhe.status), ativo=i<=idx, st=STATUS[s];
                return(
                  <div key={s} style={{ flex:1 }}>
                    <div style={{ height:7,borderRadius:4,background:ativo?st.cor:C.border,marginBottom:4,transition:"background 0.3s" }}/>
                    <div style={{ fontSize:9,color:ativo?st.cor:C.muted,textAlign:"center",fontWeight:800,textTransform:"uppercase",letterSpacing:0.3 }}>{st.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <Timeline historico={historicoDetalhe}/>
        </Card>
      </div>
    </div>
  );

  // ── MEUS CHAMADOS ─────────────────────────────────────────────────────────
  if(tela==="meus-chamados") return(
    <div className="fadeIn" style={{ minHeight:"100vh",background:C.bg,fontFamily:FF }}>
      <Hdr titulo="📋 Meus Chamados" sub={municipio?.nome} onVoltar={()=>setTela("home")}/>
      <div style={{ padding:"20px 16px",maxWidth:700,margin:"0 auto" }}>
        {carregando?(
          <div style={{ textAlign:"center",padding:60,color:C.muted }}>
            <div style={{ fontSize:36,animation:"pulse 1.2s infinite" }}>⏳</div>
            <div style={{ marginTop:12,fontWeight:700 }}>Carregando...</div>
          </div>
        ):meusChamados.length===0?(
          <Card style={{ textAlign:"center",padding:"48px 24px" }}>
            <div style={{ fontSize:54,marginBottom:16 }}>📭</div>
            <div style={{ fontSize:20,fontWeight:900,color:C.navy,marginBottom:8 }}>Nenhum chamado ainda</div>
            <div style={{ fontSize:14,color:C.sub,marginBottom:28 }}>Você ainda não reportou nenhum problema.</div>
            <Btn onClick={()=>setTela("reporte")}>Reportar agora</Btn>
          </Card>
        ):(
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            {meusChamados.map((c,i)=>(
              <div key={c.id} className="card-hover slideUp" onClick={()=>abrirDetalhe(c)}
                style={{ background:C.card,borderRadius:18,padding:18,boxShadow:"0 2px 14px rgba(13,31,78,0.07)",cursor:"pointer",border:`1.5px solid ${C.border}`,animationDelay:`${i*0.05}s` }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                  <div style={{ fontSize:16,fontWeight:800,color:C.navy,flex:1,marginRight:12 }}>{c.titulo}</div>
                  <Badge status={c.status}/>
                </div>
                {c.fotoURL&&<img src={c.fotoURL} alt="foto" style={{ width:"100%",borderRadius:10,maxHeight:140,objectFit:"cover",marginBottom:10 }}/>}
                <div style={{ fontSize:13,color:C.sub,marginBottom:8,lineHeight:1.5 }}>{c.descricao}</div>
                <div style={{ fontSize:12,color:C.muted,display:"flex",gap:10,flexWrap:"wrap" }}>
                  <span>📂 {c.categoria}</span>
                  <span>📅 {c.criadoEm?.toDate?c.criadoEm.toDate().toLocaleDateString("pt-BR"):""}</span>
                  {c.latitude&&<span style={{ color:C.green,fontWeight:700 }}>📍 Localização</span>}
                </div>
                <div style={{ fontSize:12,color:C.blue,marginTop:10,fontWeight:800 }}>Ver detalhes →</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── PAINEL ADMIN ──────────────────────────────────────────────────────────
  if(tela==="painel") return(
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:FF }}>
      <Lightbox src={fotoLightbox} onClose={()=>setFotoLightbox(null)}/>
      <Hdr titulo={`🏛️ ${municipio?.nome}`} sub="Cívico — Gestão de Chamados"
        acoes={[<HdrBtn key="r" onClick={carregarChamados}>🔄</HdrBtn>,<HdrBtn key="s" onClick={sair}>Sair</HdrBtn>]}
      />
      <div style={{ background:C.card,borderBottom:`1.5px solid ${C.border}`,display:"flex",boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        {[["dashboard","📊 Dashboard"],["lista","📋 Chamados"],["mapa","🗺️ Mapa"]].map(([aba,label])=>(
          <button key={aba} onClick={()=>setAbaPainel(aba)} style={{ padding:"14px 20px",border:"none",cursor:"pointer",fontSize:13,fontWeight:800,background:"transparent",fontFamily:FF,color:abaPainel===aba?C.blue:C.muted,borderBottom:abaPainel===aba?`3px solid ${C.blue}`:"3px solid transparent",transition:"color 0.2s" }}>{label}</button>
        ))}
      </div>
      <div style={{ padding:"20px 16px",maxWidth:1100,margin:"0 auto" }}>
        {abaPainel==="dashboard"&&(carregando?<div style={{ textAlign:"center",padding:60,color:C.muted }}>Carregando...</div>:<Dashboard chamados={chamados}/>)}
        {abaPainel==="mapa"&&(
          <Card>
            <div style={{ fontSize:15,fontWeight:800,color:C.navy,marginBottom:18 }}>🗺️ Mapa de Ocorrências</div>
            <MapaChamados chamados={chamados}/>
          </Card>
        )}
        {abaPainel==="lista"&&(
          <div style={{ background:C.card,borderRadius:18,boxShadow:"0 2px 16px rgba(13,31,78,0.06)",overflow:"hidden",border:`1.5px solid ${C.border}` }}>
            <div style={{ background:`linear-gradient(135deg,${C.navy},${C.blue})`,padding:"14px 20px" }}>
              <div style={{ fontSize:15,fontWeight:800,color:"white",fontFamily:FF }}>📋 Chamados Recebidos</div>
            </div>
            {carregando?(
              <div style={{ padding:48,textAlign:"center",color:C.muted }}>Carregando...</div>
            ):chamados.length===0?(
              <div style={{ padding:48,textAlign:"center",color:C.muted }}>
                <div style={{ fontSize:42,marginBottom:12 }}>📭</div>
                <div style={{ fontWeight:700,marginBottom:20 }}>Nenhum chamado ainda.</div>
                <button onClick={carregarChamados} style={{ background:C.blue,color:"white",border:"none",borderRadius:10,padding:"10px 22px",cursor:"pointer",fontWeight:800,fontFamily:FF }}>Carregar chamados</button>
              </div>
            ):chamados.map((c,i)=>(
              <div key={c.id} className="fadeIn" style={{ padding:"18px 20px",borderBottom:`1px solid ${C.border}`,background:i%2===0?C.card:"#FAFBFF",animationDelay:`${i*0.03}s` }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap" }}>
                  <Badge status={c.status}/>
                  <span style={{ fontSize:12,color:C.muted,background:C.bg,padding:"3px 10px",borderRadius:8,fontWeight:700 }}>{c.categoria}</span>
                  {c.latitude&&<span style={{ fontSize:12,color:C.green,fontWeight:800 }}>📍 Com localização</span>}
                </div>
                <div style={{ fontSize:15,fontWeight:800,color:C.navy,marginBottom:4 }}>{c.titulo}</div>
                <div style={{ fontSize:13,color:C.sub,marginBottom:8,lineHeight:1.5 }}>{c.descricao}</div>
                {c.fotoURL&&(
                  <div style={{ marginBottom:12,cursor:"zoom-in" }} onClick={()=>setFotoLightbox(c.fotoURL)}>
                    <img src={c.fotoURL} alt="foto" style={{ width:"100%",maxWidth:320,borderRadius:12,maxHeight:180,objectFit:"cover" }}/>
                    <div style={{ fontSize:11,color:C.muted,marginTop:4,fontWeight:700 }}>🔍 Clique para ampliar</div>
                  </div>
                )}
                <div style={{ fontSize:12,color:C.muted,marginBottom:12 }}>👤 {c.email}</div>
                <input placeholder="Observação (opcional)" value={obsStatus} onChange={e=>setObsStatus(e.target.value)} style={{ ...inp,fontSize:13,padding:"9px 12px",marginBottom:10 }}/>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {FLUXO.filter(s=>s!==c.status).map(s=>{
                    const st=STATUS[s];
                    return <button key={s} onClick={()=>mudarStatus(c.id,s)} style={{ background:st.bg,color:st.cor,border:`1.5px solid ${st.cor}33`,borderRadius:10,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:800,fontFamily:FF,transition:"opacity 0.15s" }} onMouseEnter={e=>e.currentTarget.style.opacity="0.75"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{st.emoji} {st.label}</button>;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── REPORTE ───────────────────────────────────────────────────────────────
  if(tela==="reporte") return(
    <div className="fadeIn" style={{ minHeight:"100vh",background:C.bg,fontFamily:FF }}>
      <Hdr titulo="📸 Reportar Problema" sub={municipio?.nome} onVoltar={()=>{setTela("home");setSucesso(false);}}/>
      <div style={{ padding:"20px 16px",maxWidth:600,margin:"0 auto" }}>
        {sucesso?(
          <Card style={{ textAlign:"center",padding:"48px 24px" }}>
            <div style={{ fontSize:64,marginBottom:16 }}>✅</div>
            <div style={{ fontSize:22,fontWeight:900,color:C.green,marginBottom:8 }}>Reporte enviado!</div>
            <div style={{ fontSize:15,color:C.sub,marginBottom:28 }}>Sua solicitação foi registrada em <strong>{municipio?.nome}</strong>.</div>
            <Btn onClick={()=>setSucesso(false)}>Reportar outro</Btn>
          </Card>
        ):(
          <Card>
            <div style={{ background:"linear-gradient(135deg,#EEF3FE,#E0E7FF)",borderRadius:12,padding:"10px 14px",marginBottom:18,display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ fontSize:18 }}>🏙️</span>
              <span style={{ fontSize:13,color:C.blue,fontWeight:800 }}>{municipio?.nome} — {municipio?.estado}</span>
            </div>
            <div style={{ marginBottom:16 }}>
              <Lbl>Categoria</Lbl>
              <select value={categoria} onChange={e=>setCategoria(e.target.value)} style={{ ...inp,marginBottom:0 }}>
                <option value="">Selecione...</option>
                <option value="buraco">🕳️ Buraco na rua</option>
                <option value="iluminacao">💡 Iluminação pública</option>
                <option value="lixo">🗑️ Lixo acumulado</option>
                <option value="calcada">🚶 Calçada danificada</option>
                <option value="arvore">🌳 Árvore caída</option>
                <option value="esgoto">💧 Esgoto a céu aberto</option>
                <option value="outro">📌 Outro</option>
              </select>
            </div>
            <div style={{ marginBottom:16,position:"relative" }}>
              <Lbl>{buscandoEnd?"🔍 Buscando endereço...":"Endereço / Título"}</Lbl>
              <input placeholder="Ex: Rua das Flores, 123" value={titulo} onChange={e=>{setTitulo(e.target.value);buscarEndereco(e.target.value);}} style={{ ...inp,marginBottom:0 }}/>
              {sugestoes.length>0&&(
                <div style={{ position:"absolute",zIndex:100,background:C.card,border:`1.5px solid ${C.border}`,borderRadius:12,boxShadow:"0 10px 28px rgba(0,0,0,0.12)",width:"100%",maxHeight:200,overflowY:"auto",top:"calc(100% + 4px)" }}>
                  {sugestoes.map((s,i)=>(
                    <div key={i} onPointerDown={()=>{setTitulo(s);setSugestoes([]);}} style={{ padding:"10px 14px",fontSize:13,color:C.text,cursor:"pointer",borderBottom:i<sugestoes.length-1?`1px solid ${C.border}`:"none",fontWeight:600,transition:"background 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background=C.bg} onMouseLeave={e=>e.currentTarget.style.background="white"}>📍 {s}</div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom:16 }}>
              <Lbl>Descrição</Lbl>
              <textarea placeholder="Descreva o problema com detalhes..." value={descricao} onChange={e=>setDescricao(e.target.value)} rows={4} style={{ ...inp,resize:"vertical",lineHeight:1.6 }}/>
            </div>
            <UploadFoto foto={foto} setFoto={setFoto} preview={preview} setPreview={setPreview}/>
            <div style={{ marginBottom:20 }}>
              <Lbl sub="(opcional)">📍 Localização</Lbl>
              {localizacao?(
                <div style={{ background:"#DCFCE7",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",border:"1.5px solid #86EFAC" }}>
                  <span style={{ fontSize:13,color:C.green,fontWeight:800 }}>✅ Localização capturada!</span>
                  <button onClick={()=>setLocalizacao(null)} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:13,fontWeight:800 }}>Remover</button>
                </div>
              ):(
                <button onClick={capturarLocalizacao} style={{ width:"100%",padding:"14px",borderRadius:12,border:`2px dashed ${C.border}`,background:"#F8FAFF",cursor:"pointer",fontSize:14,color:C.sub,fontWeight:700,fontFamily:FF,transition:"border-color 0.2s,background 0.2s" }} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.background="#EEF3FE";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background="#F8FAFF";}}>📍 Capturar minha localização</button>
              )}
            </div>
            <Btn onClick={enviarReporte} disabled={enviando}>{enviando?"⏳ Enviando...":"📤 Enviar Reporte"}</Btn>
          </Card>
        )}
      </div>
    </div>
  );

  // ── HOME ──────────────────────────────────────────────────────────────────
  if(tela==="home") return(
    <div className="fadeIn" style={{ minHeight:"100vh",background:C.bg,fontFamily:FF }}>
      <div style={{ background:`linear-gradient(135deg,${C.navy} 0%,${C.blue} 100%)`,padding:"24px 20px 36px",boxShadow:"0 4px 24px rgba(13,31,78,0.18)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",maxWidth:800,margin:"0 auto" }}>
          <div>
            <div style={{ fontSize:24,fontWeight:900,color:"white",letterSpacing:-0.5 }}>🏙️ Cívico</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:2 }}>{municipio?.nome} — {municipio?.estado}</div>
          </div>
          <HdrBtn onClick={sair}>Sair</HdrBtn>
        </div>
        <div style={{ maxWidth:800,margin:"20px auto 0" }}>
          <div style={{ fontSize:26,fontWeight:900,color:"white",marginBottom:4 }}>Olá! 👋</div>
          <div style={{ fontSize:14,color:"rgba(255,255,255,0.65)" }}>O que você quer fazer hoje?</div>
        </div>
      </div>
      <div style={{ padding:"20px 16px",maxWidth:800,margin:"0 auto",marginTop:-18 }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
          {[
            {tela:"reporte",emoji:"📸",titulo:"Reportar Problema",sub:"Registre um problema na sua cidade",hl:true,delay:"0s"},
            {tela:"meus-chamados",emoji:"📋",titulo:"Meus Chamados",sub:"Acompanhe o status dos seus reportes",hl:false,delay:"0.08s"},
          ].map(item=>(
            <div key={item.tela} className="slideUp" style={{ animationDelay:item.delay }}>
              <Card onClick={()=>setTela(item.tela)} highlight={item.hl} style={{ height:"100%" }}>
                <div style={{ fontSize:42,marginBottom:14 }}>{item.emoji}</div>
                <div style={{ fontSize:16,fontWeight:900,color:C.navy,marginBottom:6 }}>{item.titulo}</div>
                <div style={{ fontSize:13,color:C.sub,lineHeight:1.5 }}>{item.sub}</div>
                <div style={{ fontSize:12,color:C.blue,marginTop:14,fontWeight:800 }}>Acessar →</div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  return(
    <div style={{ height:"100vh",overflow:"hidden",background:`linear-gradient(135deg,${C.navy} 0%,${C.blue} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:FF }}>
      <div className="slideUp" style={{ background:C.card,borderRadius:24,padding:"32px 28px",width:"100%",maxWidth:400,boxShadow:"0 24px 64px rgba(0,0,0,0.28)",maxHeight:"96vh",overflowY:"auto" }}>
        <div style={{ textAlign:"center",marginBottom:24 }}>
          <div style={{ fontSize:42,fontWeight:900,color:C.navy,letterSpacing:-1 }}>🏙️ Cívico</div>
          <div style={{ fontSize:13,color:C.muted,marginTop:4,fontWeight:600 }}>A cidade nas suas mãos</div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12,fontWeight:800,color:C.navy,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5 }}>🏙️ Sua cidade</label>
          <select value={municipioSel} onChange={e=>setMunicipioSel(e.target.value)} style={{ ...inp,marginBottom:0 }} disabled={carregandoMun}>
            <option value="">{carregandoMun?"⏳ Carregando cidades...":"Selecione sua cidade..."}</option>
            {municipios.map(m=><option key={m.id} value={m.id}>{m.nome} — {m.estado}</option>)}
          </select>
        </div>
        <div style={{ display:"flex",background:"#F1F5F9",borderRadius:12,padding:4,marginBottom:14 }}>
          {[["cidadao","👤 Cidadão"],["admin","🏛️ Administração"]].map(([val,label])=>(
            <button key={val} onClick={()=>{setTipoLogin(val);setErro("");setTela("login");}}
              style={{ flex:1,padding:"10px 8px",borderRadius:9,border:"none",cursor:"pointer",fontSize:val==="admin"?12:14,fontWeight:800,fontFamily:FF,background:tipoLogin===val?"white":"transparent",color:tipoLogin===val?C.navy:C.muted,boxShadow:tipoLogin===val?"0 2px 10px rgba(0,0,0,0.10)":"none",transition:"all 0.2s" }}
            >{label}</button>
          ))}
        </div>
        {erro&&<div style={{ background:"#FEE2E2",color:C.red,fontSize:13,marginBottom:14,padding:"10px 14px",borderRadius:10,textAlign:"center",fontWeight:700 }}>{erro}</div>}
        <input placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} type="email" style={inp}/>
        <div style={{ position:"relative",marginBottom:10 }}>
          <input placeholder="Senha" value={senha} onChange={e=>setSenha(e.target.value)} type={mostrarSenha?"text":"password"} style={{ ...inp,marginBottom:0,paddingRight:50 }}/>
          <button onClick={()=>setMostrarSenha(!mostrarSenha)} style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.muted,padding:4 }}>{mostrarSenha?"🙈":"👁️"}</button>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:18 }}>
          <input type="checkbox" id="lembrar" checked={lembrar} onChange={e=>setLembrar(e.target.checked)} style={{ width:16,height:16,cursor:"pointer",accentColor:C.blue }}/>
          <label htmlFor="lembrar" style={{ fontSize:13,color:C.sub,cursor:"pointer",fontWeight:600 }}>Lembrar meu e-mail</label>
        </div>
        {tela==="login"?(
          <>
            <Btn onClick={entrar}>Entrar</Btn>
            {tipoLogin==="cidadao"&&<div style={{ textAlign:"center",fontSize:14,color:C.muted,marginTop:4 }}>Não tem conta? <Lnk onClick={()=>{setTela("cadastro");setErro("");}}>Cadastre-se</Lnk></div>}
            <div style={{ textAlign:"center",marginTop:8 }}><Lnk onClick={esqueceuSenha}>Esqueci minha senha</Lnk></div>
          </>
        ):(
          <>
            <Btn onClick={cadastrar} color="green">Criar conta</Btn>
            <div style={{ textAlign:"center",fontSize:14,color:C.muted,marginTop:4 }}>Já tem conta? <Lnk onClick={()=>{setTela("login");setErro("");}}>Entrar</Lnk></div>
          </>
        )}
      </div>
    </div>
  );
}