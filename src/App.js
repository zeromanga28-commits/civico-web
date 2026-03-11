import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";

const ADMIN_EMAIL = "prefeitura@civico.com";

export default function App() {
  const [tela, setTela] = useState("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [usuario, setUsuario] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [chamados, setChamados] = useState([]);
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    try {
      const result = await signInWithEmailAndPassword(auth, email, senha);
      setUsuario(result.user);
      setTela(result.user.email === ADMIN_EMAIL ? "painel" : "home");
    } catch (e) {
      setErro("E-mail ou senha incorretos.");
    }
  }

  async function cadastrar() {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, senha);
      setUsuario(result.user);
      setTela("home");
    } catch (e) {
      setErro("Erro ao cadastrar. Tente outro e-mail.");
    }
  }

  async function sair() {
    await signOut(auth);
    setUsuario(null);
    setTela("login");
  }

  async function enviarReporte() {
    if (!titulo || !descricao || !categoria) {
      alert("Preencha todos os campos!");
      return;
    }
    setEnviando(true);
    try {
      await addDoc(collection(db, "chamados"), {
        titulo, descricao, categoria,
        status: "aberto",
        email: usuario.email,
        userId: usuario.uid,
        criadoEm: serverTimestamp()
      });
      setSucesso(true);
      setTitulo(""); setDescricao(""); setCategoria("");
    } catch (e) {
      alert("Erro ao enviar. Tente novamente.");
    }
    setEnviando(false);
  }

  async function carregarChamados() {
    setCarregando(true);
    try {
      const q = query(collection(db, "chamados"), orderBy("criadoEm", "desc"));
      const snap = await getDocs(q);
      setChamados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setCarregando(false);
  }

  async function mudarStatus(id, novoStatus) {
    await updateDoc(doc(db, "chamados", id), { status: novoStatus });
    carregarChamados();
  }

  useEffect(() => {
    if (tela === "painel") carregarChamados();
  }, [tela]);

  const statusCor = { aberto: "#B91C1C", "em andamento": "#B45309", resolvido: "#0A7C4E" };
  const statusBg  = { aberto: "#FEE2E2", "em andamento": "#FEF3C7", resolvido: "#DCFCE7" };
  const statusLabel = { aberto: "🔴 Aberto", "em andamento": "🟡 Em andamento", resolvido: "🟢 Resolvido" };

  // ── PAINEL PREFEITURA ─────────────────────────────────────────
  if (tela === "painel") return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Arial, sans-serif" }}>
      <div style={{
        background: "linear-gradient(135deg, #0D1F4E, #1B4FD8)",
        padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>🏛️ Painel da Prefeitura</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>Cívico — Gestão de Chamados</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={carregarChamados} style={{
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
            color: "white", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 14
          }}>🔄 Atualizar</button>
          <button onClick={sair} style={{
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
            color: "white", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 14
          }}>Sair</button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ padding: "24px 32px 0", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Total de Chamados", valor: chamados.length, cor: "#1B4FD8", bg: "#EEF3FE", emoji: "📋" },
            { label: "Em Aberto", valor: chamados.filter(c => c.status === "aberto").length, cor: "#B91C1C", bg: "#FEE2E2", emoji: "🔴" },
            { label: "Resolvidos", valor: chamados.filter(c => c.status === "resolvido").length, cor: "#0A7C4E", bg: "#DCFCE7", emoji: "🟢" },
          ].map((s, i) => (
            <div key={i} style={{ background: "white", borderRadius: 16, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{s.emoji}</div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 900, color: s.cor }}>{s.valor}</div>
                <div style={{ fontSize: 14, color: "#64748B" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* TABELA */}
        <div style={{ background: "white", borderRadius: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ background: "#0D1F4E", padding: "16px 24px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>📋 Chamados Recebidos</div>
          </div>

          {carregando ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Carregando...</div>
          ) : chamados.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Nenhum chamado ainda.</div>
          ) : (
            chamados.map((c, i) => (
              <div key={c.id} style={{
                padding: "20px 24px", borderBottom: "1px solid #F1F5F9",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: i % 2 === 0 ? "white" : "#FAFAFA"
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{
                      background: statusBg[c.status], color: statusCor[c.status],
                      fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20
                    }}>{statusLabel[c.status]}</span>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>{c.categoria}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0D1F4E", marginBottom: 4 }}>{c.titulo}</div>
                  <div style={{ fontSize: 14, color: "#64748B", marginBottom: 4 }}>{c.descricao}</div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>👤 {c.email}</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: 24 }}>
                  {c.status !== "em andamento" && (
                    <button onClick={() => mudarStatus(c.id, "em andamento")} style={{
                      background: "#FEF3C7", color: "#B45309", border: "none",
                      borderRadius: 8, padding: "8px 14px", cursor: "pointer",
                      fontSize: 13, fontWeight: 700
                    }}>🟡 Em andamento</button>
                  )}
                  {c.status !== "resolvido" && (
                    <button onClick={() => mudarStatus(c.id, "resolvido")} style={{
                      background: "#DCFCE7", color: "#0A7C4E", border: "none",
                      borderRadius: 8, padding: "8px 14px", cursor: "pointer",
                      fontSize: 13, fontWeight: 700
                    }}>🟢 Marcar resolvido</button>
                  )}
                  {c.status !== "aberto" && (
                    <button onClick={() => mudarStatus(c.id, "aberto")} style={{
                      background: "#FEE2E2", color: "#B91C1C", border: "none",
                      borderRadius: 8, padding: "8px 14px", cursor: "pointer",
                      fontSize: 13, fontWeight: 700
                    }}>🔴 Reabrir</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // ── TELA REPORTE ─────────────────────────────────────────────
  if (tela === "reporte") return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Arial, sans-serif" }}>
      <div style={{
        background: "linear-gradient(135deg, #0D1F4E, #1B4FD8)",
        padding: "20px 32px", display: "flex", alignItems: "center", gap: 16
      }}>
        <button onClick={() => { setTela("home"); setSucesso(false); }} style={{
          background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
          color: "white", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 14
        }}>← Voltar</button>
        <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>📸 Reportar Problema</div>
      </div>

      <div style={{ padding: 32, maxWidth: 600, margin: "0 auto" }}>
        {sucesso ? (
          <div style={{ background: "white", borderRadius: 20, padding: 40, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0A7C4E", marginBottom: 8 }}>Reporte enviado!</div>
            <div style={{ fontSize: 16, color: "#64748B", marginBottom: 32 }}>Sua solicitação foi registrada. A prefeitura será notificada.</div>
            <button onClick={() => setSucesso(false)} style={{
              background: "linear-gradient(135deg, #0D1F4E, #1B4FD8)",
              color: "white", border: "none", borderRadius: 12,
              padding: "14px 32px", fontSize: 16, fontWeight: 700, cursor: "pointer"
            }}>Reportar outro problema</button>
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: 20, padding: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#0D1F4E", display: "block", marginBottom: 8 }}>Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} style={{
                width: "100%", padding: "14px 16px", borderRadius: 12,
                border: "1.5px solid #E2E8F0", fontSize: 15,
                boxSizing: "border-box", outline: "none", background: "white"
              }}>
                <option value="">Selecione uma categoria...</option>
                <option value="buraco">🕳️ Buraco na rua</option>
                <option value="iluminacao">💡 Iluminação pública</option>
                <option value="lixo">🗑️ Lixo acumulado</option>
                <option value="calcada">🚶 Calçada danificada</option>
                <option value="arvore">🌳 Árvore caída</option>
                <option value="esgoto">💧 Esgoto a céu aberto</option>
                <option value="outro">📌 Outro</option>
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#0D1F4E", display: "block", marginBottom: 8 }}>Título</label>
              <input placeholder="Ex: Buraco na Rua das Flores" value={titulo} onChange={e => setTitulo(e.target.value)} style={{
                width: "100%", padding: "14px 16px", borderRadius: 12,
                border: "1.5px solid #E2E8F0", fontSize: 15,
                boxSizing: "border-box", outline: "none"
              }} />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#0D1F4E", display: "block", marginBottom: 8 }}>Descrição</label>
              <textarea placeholder="Descreva o problema com detalhes..." value={descricao} onChange={e => setDescricao(e.target.value)} rows={4} style={{
                width: "100%", padding: "14px 16px", borderRadius: 12,
                border: "1.5px solid #E2E8F0", fontSize: 15,
                boxSizing: "border-box", outline: "none", resize: "vertical"
              }} />
            </div>
            <button onClick={enviarReporte} disabled={enviando} style={{
              width: "100%", padding: "16px", borderRadius: 12,
              background: enviando ? "#94A3B8" : "linear-gradient(135deg, #0D1F4E, #1B4FD8)",
              color: "white", fontSize: 16, fontWeight: 700,
              border: "none", cursor: enviando ? "not-allowed" : "pointer"
            }}>{enviando ? "Enviando..." : "📤 Enviar Reporte"}</button>
          </div>
        )}
      </div>
    </div>
  );

  // ── TELA HOME ─────────────────────────────────────────────────
  if (tela === "home") return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Arial, sans-serif" }}>
      <div style={{
        background: "linear-gradient(135deg, #0D1F4E, #1B4FD8)",
        padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: "white" }}>🏙️ Cívico</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>{usuario?.email}</span>
          <button onClick={sair} style={{
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
            color: "white", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 14
          }}>Sair</button>
        </div>
      </div>
      <div style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ color: "#0D1F4E", fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Olá! 👋</h2>
        <p style={{ color: "#64748B", marginBottom: 32 }}>O que você quer fazer hoje?</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div onClick={() => setTela("reporte")} style={{
            background: "white", borderRadius: 20, padding: 28,
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)", cursor: "pointer", border: "2px solid #EEF3FE"
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0D1F4E", marginBottom: 8 }}>Reportar Problema</div>
            <div style={{ fontSize: 14, color: "#64748B" }}>Fotografe e registre um problema na sua cidade</div>
          </div>
          <div style={{
            background: "white", borderRadius: 20, padding: 28,
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "2px solid #F1F5F9"
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0D1F4E", marginBottom: 8 }}>Meus Chamados</div>
            <div style={{ fontSize: 14, color: "#64748B" }}>Acompanhe o status dos seus reportes</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── LOGIN/CADASTRO ────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #0D1F4E 0%, #1B4FD8 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif"
    }}>
      <div style={{ background: "white", borderRadius: 24, padding: "48px 40px", width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: "#0D1F4E", letterSpacing: -2 }}>🏙️ Cívico</div>
          <div style={{ fontSize: 14, color: "#94A3B8", marginTop: 4 }}>A cidade nas suas mãos</div>
        </div>
        {erro && <div style={{ color: "red", fontSize: 14, marginBottom: 12, textAlign: "center" }}>{erro}</div>}
        <input placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #E2E8F0", fontSize: 15, marginBottom: 12, boxSizing: "border-box", outline: "none" }} />
        <input placeholder="Senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #E2E8F0", fontSize: 15, marginBottom: 24, boxSizing: "border-box", outline: "none" }} />
        {tela === "login" ? (
          <>
            <button onClick={entrar} style={{ width: "100%", padding: "16px", borderRadius: 12, background: "linear-gradient(135deg, #0D1F4E, #1B4FD8)", color: "white", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer" }}>Entrar</button>
            <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#94A3B8" }}>
              Não tem conta?{" "}
              <span onClick={() => { setTela("cadastro"); setErro(""); }} style={{ color: "#1B4FD8", fontWeight: 700, cursor: "pointer" }}>Cadastre-se</span>
            </div>
          </>
        ) : (
          <>
            <button onClick={cadastrar} style={{ width: "100%", padding: "16px", borderRadius: 12, background: "linear-gradient(135deg, #0A7C4E, #10B981)", color: "white", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer" }}>Criar conta</button>
            <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#94A3B8" }}>
              Já tem conta?{" "}
              <span onClick={() => { setTela("login"); setErro(""); }} style={{ color: "#1B4FD8", fontWeight: 700, cursor: "pointer" }}>Entrar</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}