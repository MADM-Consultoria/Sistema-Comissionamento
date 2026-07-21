// src/pages/Suporte.tsx
import React from "react";
import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Send,
  X,
  Download,
  Trash2,
  Eye,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  FileText,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/dataStore";
import { useAccessControl } from "@/hooks/useAccessControl";
import { API_BASE } from "@/lib/api";

// ---------------------- Tipos ----------------------
interface MovementItem {
  id: string;
  timestamp: string;
  cliente: string;
  email: string;
  telefone: string;
  cpf: string;
  origem: string;
  equipe: string;
  assessor: string;
  status: "pendente" | "processando" | "concluido" | "suporte" | "aviso" | "erro";
  resultado: string;
  usuario: string;
  atualizadoEm: string;
}

interface ReportItem {
  id: string;
  data: string;
  assunto: string;
  descricao: string;
  descricaoResumida: string;
  solicitante: string;
  equipe: string;
  status: "ENVIADO" | "SUSPEITO" | "CONCLUÍDO" | "ERRO" | "BLOQUEADO" | "REVISÃO";
  ultimaAtualizacao: string;
}

interface TicketMovimentacao {
  id_ticket_movimentacao: number;
  crm_origem: string;
  tipo_solicitacao: string;
  nome_cliente_informado: string;
  sobrenome_cliente_informado: string;
  email_cliente_informado: string;
  telefone_cliente_informado: string;
  cpf_cliente_informado: string;
  origem_cliente_informada: string;
  colaborador_origem_nome: string;
  equipe_origem_nome: string;
  colaborador_destino_nome: string;
  equipe_destino_nome: string;
  status_mapeamento: string;
  observacao_sales_ops?: string;
  criado_em: string;
}

// ---------------------- Helpers ----------------------
const formatPhoneDisplay = (phone: string): string => {
  const numbers = phone.replace(/\D/g, "");
  if (!numbers) return "";
  if (numbers.length === 13) return `+${numbers.slice(0, 2)} (${numbers.slice(2, 4)}) ${numbers.slice(4, 9)}-${numbers.slice(9)}`;
  if (numbers.length === 12) return `+${numbers.slice(0, 2)} (${numbers.slice(2, 4)}) ${numbers.slice(4, 8)}-${numbers.slice(8)}`;
  if (numbers.length === 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  if (numbers.length === 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return numbers;
};

const formatCPF = (cpf: string): string => {
  const numbers = cpf.replace(/\D/g, "");
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
};

const normalize = (str: string): string => (str || '').trim().toLowerCase();

const getStatusInfo = (status: string) => {
  const map: Record<string, { label: string; icon: React.ReactElement; className: string }> = {
    pendente: { label: "Pendente", icon: <Clock className="w-3 h-3" />, className: "bg-gray-100 text-gray-600" },
    processando: { label: "Processando", icon: <Loader2 className="w-3 h-3 animate-spin" />, className: "bg-blue-50 text-blue-700" },
    concluido: { label: "Concluído", icon: <CheckCircle className="w-3 h-3" />, className: "bg-green-50 text-green-700" },
    suporte: { label: "Suporte", icon: <AlertCircle className="w-3 h-3" />, className: "bg-orange-50 text-orange-700" },
    aviso: { label: "Aviso", icon: <AlertTriangle className="w-3 h-3" />, className: "bg-yellow-50 text-yellow-700" },
    erro: { label: "Erro", icon: <AlertCircle className="w-3 h-3" />, className: "bg-red-50 text-red-700" },
    ENVIADO: { label: "Enviado", icon: <Send className="w-3 h-3" />, className: "bg-blue-50 text-blue-700" },
    SUSPEITO: { label: "Suspeito", icon: <AlertTriangle className="w-3 h-3" />, className: "bg-yellow-50 text-yellow-700" },
    CONCLUÍDO: { label: "Concluído", icon: <CheckCircle className="w-3 h-3" />, className: "bg-green-50 text-green-700" },
    ERRO: { label: "Erro", icon: <AlertCircle className="w-3 h-3" />, className: "bg-red-50 text-red-700" },
    BLOQUEADO: { label: "Bloqueado", icon: <X className="w-3 h-3" />, className: "bg-red-100 text-red-800" },
    REVISÃO: { label: "Revisão", icon: <Eye className="w-3 h-3" />, className: "bg-purple-50 text-purple-700" },
  };
  return map[status] || { label: status, icon: <FileText className="w-3 h-3" />, className: "bg-gray-100 text-gray-600" };
};

// ---------------------- Constantes de equipes excluídas ----------------------
const EXCLUDED_TEAMS = [
  'Equipe SAC', 'Sales Ops', 'Equipe', 'Equipe Lucilene', 'Equipe SDR', 'Equipe Camila',
  'Equipe Erica', 'Equipe Lucas', 'Equipe Irene', 'Equipe Maria Eduarda', 'SalesOps',
  'Equipe Murilo Balsalobre', 'Comercial', 'Backoffice', 'CEO', 'Prontuário', 'BackOffice',
  'Equipe Leonardo Cardoso', 'Equipe Julia', 'Equipe Leticia', 'Dr. Felipe Marx', 'Administrativo',
  'Equipe Thales', 'Financeiro'
];

const isExcludedTeam = (teamName: string): boolean => {
  if (!teamName) return false;
  const n = teamName.trim().toLowerCase();
  return EXCLUDED_TEAMS.some(t => t.trim().toLowerCase() === n);
};

// ---------------------- Função auxiliar para CSRF ----------------------
function getCsrfHeaders() {
  const token = localStorage.getItem('csrfToken') || '';
  return {
    'Content-Type': 'application/json',
    'x-csrf-token': token,
  };
}

// ---------------------- Componente principal ----------------------
export default function Suporte() {
  const [activeTab, setActiveTab] = useState<"movimentacao" | "reportar" | "salesops">("reportar");
  const { getAccessLevel, LEVELS } = useAccessControl();

  const isAdmin = useMemo(() => {
    const level = getAccessLevel();
    return level === LEVELS.ADMINISTRATIVO || level === LEVELS.COORDENADOR;
  }, [getAccessLevel, LEVELS]);

  return (
    <DashboardLayout title="Suporte Operacional" subtitle="Movimentação de leads e reporte de problemas">
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-2">
          <button type="button" onClick={() => setActiveTab("reportar")} className={cn("px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors", activeTab === "reportar" ? "bg-white text-[#09175b] border-b-2 border-[#09175b]" : "text-gray-500 hover:text-gray-700")}>🔍 Reportar</button>
          <button type="button" onClick={() => setActiveTab("movimentacao")} className={cn("px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors", activeTab === "movimentacao" ? "bg-white text-[#09175b] border-b-2 border-[#09175b]" : "text-gray-500 hover:text-gray-700")}>📋 Movimentar</button>
          {isAdmin && <button type="button" onClick={() => setActiveTab("salesops")} className={cn("px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors", activeTab === "salesops" ? "bg-white text-[#09175b] border-b-2 border-[#09175b]" : "text-gray-500 hover:text-gray-700")}>📊 Visão SalesOps</button>}
        </div>
      </div>
      {activeTab === "movimentacao" && <MovimentacaoTab />}
      {activeTab === "reportar" && <ReportarTab />}
      {activeTab === "salesops" && isAdmin && <SalesOpsTab />}
    </DashboardLayout>
  );
}

// ---------------------- Aba Movimentação ----------------------
function MovimentacaoTab() {
  const {
    currentUser,
    equipeConfigs,
    loadEquipeConfigs,
    collaborators,
    loadCollaborators,
  } = useAppStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [origem, setOrigem] = useState("");
  const [equipe, setEquipe] = useState("");
  const [assessorId, setAssessorId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const equipesDisponiveis = useMemo(() => {
    if (!equipeConfigs || equipeConfigs.length === 0) return [];
    return equipeConfigs.map(eq => eq.nome).filter(nome => !isExcludedTeam(nome));
  }, [equipeConfigs]);

  useEffect(() => { if (equipeConfigs.length === 0) loadEquipeConfigs(); }, [equipeConfigs, loadEquipeConfigs]);

  const [loadingColaboradores, setLoadingColaboradores] = useState(true);
  useEffect(() => {
    let isMounted = true;
    const carregar = async () => {
      if (collaborators.length === 0) { try { await loadCollaborators(); } catch (error) { console.error("Falha ao carregar colaboradores:", error); } }
      if (isMounted) setLoadingColaboradores(false);
    };
    carregar();
    return () => { isMounted = false; };
  }, []);

  const assessoresDisponiveis = useMemo(() => {
    if (!collaborators.length) return [];
    let filtered = collaborators.filter(c => !isExcludedTeam(c.equipeNome));
    if (equipe) filtered = filtered.filter(c => normalize(c.equipeNome) === normalize(equipe));
    return filtered.map(c => ({ id: c.id.toString(), nome: c.name }));
  }, [collaborators, equipe]);

  useEffect(() => {
    if (assessorId && !assessoresDisponiveis.find(a => a.id === assessorId)) setAssessorId("");
  }, [assessoresDisponiveis, assessorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { setMessage({ text: "Nome é obrigatório", type: "error" }); return; }
    if (!lastName.trim()) { setMessage({ text: "Sobrenome é obrigatório", type: "error" }); return; }
    if (!email.trim()) { setMessage({ text: "E-mail é obrigatório", type: "error" }); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setMessage({ text: "E-mail inválido", type: "error" }); return; }
    if (!equipe || !assessorId) { setMessage({ text: "Selecione equipe e assessor", type: "error" }); return; }

    setLoading(true);
    setMessage(null);

    const assessorNome = assessoresDisponiveis.find(a => a.id === assessorId)?.nome || assessorId;

    const payload = {
      crm_origem: "CRM",
      crm_lead_id: null,
      nome_cliente_informado: firstName.trim(),
      sobrenome_cliente_informado: lastName.trim(),
      email_cliente_informado: email.trim(),
      telefone_cliente_informado: telefone || null,
      cpf_cliente_informado: cpf || null,
      origem_cliente_informada: origem || null,
      tipo_solicitacao: "Movimentação",
      colaborador_origem_nome: currentUser?.nome || currentUser?.email || 'frontend',
      equipe_origem_nome: currentUser?.equipe || '',
      colaborador_destino_nome: assessorNome,
      equipe_destino_nome: equipe,
      motivo_solicitacao: null,
      observacao_sales_ops: null,
      status_mapeamento: "pendente"
    };

    try {
      const response = await fetch(`${API_BASE}/suporte/ticket-movimentacao`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
      const result = await response.json();

      const newMovement: MovementItem = {
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date().toISOString(),
        cliente: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        telefone: telefone ? formatPhoneDisplay(telefone) : "Não informado",
        cpf: cpf ? formatCPF(cpf) : "Não informado",
        origem: origem || "Não informada",
        equipe,
        assessor: assessorNome,
        status: "pendente",
        resultado: result.message || `Movimentação registrada`,
        usuario: currentUser?.nome || 'demo',
        atualizadoEm: new Date().toISOString(),
      };

      setMovements(prev => [newMovement, ...prev]);
      setMessage({ text: result.message || "Movimentação registrada", type: result.success ? "success" : "error" });

      if (result.success) {
        setFirstName(""); setLastName(""); setEmail(""); setTelefone(""); setCpf(""); setOrigem("");
        setEquipe(""); setAssessorId("");
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Erro na movimentação", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const filteredMovements = movements.filter(m => filterStatus === "todos" || m.status === filterStatus);
  const statusOptions = ["todos", "pendente", "processando", "concluido", "suporte", "aviso", "erro"];

  const exportHistory = () => {
    if (movements.length === 0) return;
    const headers = ["Data/Hora", "Cliente", "E-mail", "Telefone", "CPF", "Equipe", "Assessor", "Status", "Resultado"];
    const rows = movements.map(m =>
      [
        new Date(m.timestamp).toLocaleString("pt-BR"),
        `"${m.cliente.replace(/"/g, '""')}"`,
        `"${m.email.replace(/"/g, '""')}"`,
        `"${m.telefone.replace(/"/g, '""')}"`,
        `"${m.cpf.replace(/"/g, '""')}"`,
        `"${m.equipe.replace(/"/g, '""')}"`,
        `"${m.assessor.replace(/"/g, '""')}"`,
        `"${getStatusInfo(m.status).label.replace(/"/g, '""')}"`,
        `"${(m.resultado || "").replace(/"/g, '""')}"`,
      ].join(";")
    );
    const csv = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimentacoes_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = () => {
    if (confirm("Limpar todo o histórico local?")) {
      setMovements([]);
      setMessage({ text: "Histórico local limpo.", type: "success" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="madm-card p-5">
        <h2 className="text-lg font-bold text-[#09175b] mb-4">Movimentação de Leads</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sobrenome *</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origem do Lead</label>
              <select value={origem} onChange={e => setOrigem(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Selecionar origem</option>
                <option value="cat">CAT</option>
                <option value="indicacao">Indicação</option>
                <option value="trafego_pago">Marketing</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} onBlur={() => telefone && setTelefone(formatPhoneDisplay(telefone))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
              <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} onBlur={() => cpf && setCpf(formatCPF(cpf))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipe Destino *</label>
              <select value={equipe} onChange={e => setEquipe(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                <option value="">Selecione uma equipe</option>
                {equipesDisponiveis.map(nome => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assessor Destino *</label>
              <select value={assessorId} onChange={e => setAssessorId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                <option value="">Selecione um assessor</option>
                {loadingColaboradores ? (
                  <option disabled>Carregando assessores...</option>
                ) : assessoresDisponiveis.length === 0 ? (
                  <option disabled>Nenhum assessor disponível</option>
                ) : (
                  assessoresDisponiveis.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)
                )}
              </select>
            </div>
          </div>
          {message && (
            <div className={cn("p-3 rounded-lg text-sm", message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")} role="status" aria-live="polite">
              {message.text}
            </div>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={loading || loadingColaboradores} className="bg-[#09175b] text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#1a2f8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? "Enviando..." : "Registrar Movimentação"}
            </button>
          </div>
        </form>
      </div>

      <div className="madm-card p-5">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <h2 className="text-lg font-bold text-[#09175b]">Histórico Local</h2>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1 border rounded text-sm">
              {statusOptions.map(s => <option key={s} value={s}>{s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <button onClick={exportHistory} className="text-sm bg-gray-100 px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-200"><Download className="w-3 h-3" /> Exportar</button>
            <button onClick={clearHistory} className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded flex items-center gap-1 hover:bg-red-100"><Trash2 className="w-3 h-3" /> Limpar</button>
          </div>
        </div>
        {filteredMovements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhuma movimentação registrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2">Data/Hora</th><th className="pb-2">Cliente</th><th className="pb-2">E-mail</th>
                  <th className="pb-2">Contato</th><th className="pb-2">Equipe/Assessor</th><th className="pb-2">Status</th><th className="pb-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map(m => {
                  const info = getStatusInfo(m.status);
                  return (
                    <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 whitespace-nowrap">{new Date(m.timestamp).toLocaleString("pt-BR")}</td>
                      <td className="py-2">{m.cliente}</td><td className="py-2">{m.email}</td>
                      <td className="py-2"><div>{m.telefone}</div><small className="text-gray-400">{m.cpf}</small></td>
                      <td className="py-2"><div>{m.equipe}</div><small>{m.assessor}</small></td>
                      <td className="py-2"><span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", info.className)}>{info.icon} {info.label}</span></td>
                      <td className="py-2 max-w-xs truncate">{m.resultado}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------- Aba Reportar ----------------------
function ReportarTab() {
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assunto || !descricao.trim()) {
      setMessage({ text: "Preencha assunto e descrição", type: "error" });
      return;
    }
    if (descricao.replace(/\n/g, "").length < 10) {
      setMessage({ text: "Descrição muito curta (mínimo 10 caracteres)", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    const payload = {
      assunto,
      descricao,
      files: files.map(f => f.name),
    };

    try {
      const res = await fetch(`${API_BASE}/suporte/ticket-suporte`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao registar reporte');

      const newReport: ReportItem = {
        id: `REP_${Date.now()}`,
        data: new Date().toISOString(),
        assunto,
        descricao,
        descricaoResumida: descricao.length > 200 ? descricao.substring(0, 200) + "..." : descricao,
        solicitante: "Usuário atual",
        equipe: "Equipe atual",
        status: "ENVIADO",
        ultimaAtualizacao: new Date().toISOString(),
      };
      setReports(prev => [newReport, ...prev]);
      setMessage({ text: "Reporte registado com sucesso.", type: "success" });
      setAssunto("");
      setDescricao("");
      setFiles([]);
      const fileInput = document.getElementById("reportar-arquivos") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      setMessage({ text: err.message || "Erro ao registar reporte", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const exportReports = () => {
    if (reports.length === 0) return;
    const headers = ["ID", "Data", "Assunto", "Descrição", "Solicitante", "Equipe", "Status"];
    const rows = reports.map(r => [
      r.id,
      new Date(r.data).toLocaleString("pt-BR"),
      `"${r.assunto.replace(/"/g, '""')}"`,
      `"${r.descricao.replace(/"/g, '""').replace(/\n/g, " ")}"`,
      `"${r.solicitante.replace(/"/g, '""')}"`,
      `"${r.equipe.replace(/"/g, '""')}"`,
      `"${r.status}"`,
    ].join(";"));
    const csv = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reportes_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearReports = () => {
    if (confirm("Limpar todos os reportes?")) {
      setReports([]);
      setMessage({ text: "Reportes limpos.", type: "success" });
    }
  };

  const updateAllReportsStatus = () => {
    setReports(prev => prev.map(r => ({ ...r, status: r.status === "ENVIADO" ? "CONCLUÍDO" : r.status, ultimaAtualizacao: new Date().toISOString() })));
    setMessage({ text: "Status atualizados (simulação).", type: "success" });
  };

  const filteredReports = reports.filter(r => filterStatus === "todos" || r.status === filterStatus);
  const statusOptions = ["todos", "ENVIADO", "SUSPEITO", "CONCLUÍDO", "ERRO", "BLOQUEADO", "REVISÃO"];

  const viewDetails = (report: ReportItem) => {
    alert(`Detalhes do reporte:\nID: ${report.id}\nAssunto: ${report.assunto}\nDescrição: ${report.descricao}\nStatus: ${report.status}`);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="madm-card p-5">
        <h2 className="text-lg font-bold text-[#09175b] mb-4">Reportar Problema</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="rep-assunto" className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
            <select id="rep-assunto" value={assunto} onChange={e => setAssunto(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
              <option value="">Selecionar assunto</option>
              <option value="Discadora">Discadora</option>
              <option value="CRM">CRM</option>
              <option value="Dash">Dash</option>
              <option value="Acesso">Acessos</option>
              <option value="Reversao">Reversão</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label htmlFor="rep-descricao" className="block text-sm font-medium text-gray-700 mb-1">Descrição Detalhada</label>
            <textarea id="rep-descricao" value={descricao} onChange={e => setDescricao(e.target.value)} rows={5} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
            <div className="text-right text-xs text-gray-400 mt-1">{descricao.length}/1000 caracteres</div>
          </div>
          <div>
            <label htmlFor="reportar-arquivos" className="block text-sm font-medium text-gray-700 mb-1">Anexar Arquivos</label>
            <input type="file" id="reportar-arquivos" multiple onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:bg-gray-100 hover:file:bg-gray-200" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                    <span className="truncate">{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                    <button type="button" onClick={() => removeFile(idx)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {message && (
            <div className={cn("p-3 rounded-lg text-sm", message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")} role="status" aria-live="polite">{message.text}</div>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="bg-[#09175b] text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#1a2f8a] transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? "Enviando..." : "Enviar Reporte"}
            </button>
          </div>
        </form>
      </div>

      <div className="madm-card p-5">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <h2 className="text-lg font-bold text-[#09175b]">Meus Reportes</h2>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1 border rounded text-sm">
              {statusOptions.map(s => <option key={s} value={s}>{s === "todos" ? "Todos" : s}</option>)}
            </select>
            <button type="button" onClick={exportReports} className="text-sm bg-gray-100 px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-200"><Download className="w-3 h-3" /> Exportar</button>
            <button type="button" onClick={clearReports} className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded flex items-center gap-1 hover:bg-red-100"><Trash2 className="w-3 h-3" /> Limpar</button>
            <button type="button" onClick={updateAllReportsStatus} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded flex items-center gap-1 hover:bg-blue-100"><RefreshCw className="w-3 h-3" /> Atualizar Status</button>
          </div>
        </div>
        {filteredReports.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhum reporte enviado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2">Data</th><th className="pb-2">Assunto</th><th className="pb-2">Status</th><th className="pb-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(r => {
                  const statusInfo = getStatusInfo(r.status);
                  return (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 whitespace-nowrap">{new Date(r.data).toLocaleString("pt-BR")}</td>
                      <td className="py-2">{r.assunto}</td>
                      <td className="py-2"><span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", statusInfo.className)}>{statusInfo.icon} {statusInfo.label}</span></td>
                      <td className="py-2">
                        <button type="button" onClick={() => viewDetails(r)} className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------- Visão SalesOps (com sub-abas) ----------------------
function SalesOpsTab() {
  const [subTab, setSubTab] = useState<"casos" | "movimentacoes">("casos");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button onClick={() => setSubTab("casos")} className={cn("px-3 py-1 text-sm font-medium rounded-t", subTab === "casos" ? "bg-white border-b-2 border-[#09175b] text-[#09175b]" : "text-gray-500")}>Casos</button>
        <button onClick={() => setSubTab("movimentacoes")} className={cn("px-3 py-1 text-sm font-medium rounded-t", subTab === "movimentacoes" ? "bg-white border-b-2 border-[#09175b] text-[#09175b]" : "text-gray-500")}>Movimentações (Suporte)</button>
      </div>
      {subTab === "casos" ? <CasosTab /> : <MovimentacoesSuporteTab />}
    </div>
  );
}

// Sub-aba Casos (mantida a lógica original)
function CasosTab() {
  const [casos, setCasos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCaso, setSelectedCaso] = useState<any>(null);
  const [observacao, setObservacao] = useState("");
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);

  useEffect(() => {
    const carregarCasos = async () => {
      try {
        const res = await fetch(`${API_BASE}/suporte/casos`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) setCasos(data.data);
        else setMessage({ text: "Erro ao carregar casos", type: "error" });
      } catch (err) {
        setMessage({ text: "Erro ao carregar casos", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    carregarCasos();
  }, []);

  const handleConcluir = async () => {
    if (!selectedCaso) return;
    try {
      const res = await fetch(`${API_BASE}/suporte/caso/${selectedCaso.id}`, {
        method: 'PATCH',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({ observacao }),
      });
      const data = await res.json();
      if (data.success) {
        setCasos(prev => prev.map(c => c.id === selectedCaso.id ? { ...c, status: 'Concluído', data_conclusao: new Date().toISOString().split('T')[0], observacao } : c));
        setMessage({ text: "Caso concluído com sucesso", type: "success" });
      } else {
        setMessage({ text: data.message || "Erro ao concluir", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setModalOpen(false);
      setSelectedCaso(null);
      setObservacao("");
    }
  };

  const abrirConclusao = (caso: any) => {
    setSelectedCaso(caso);
    setObservacao(caso.observacao || "");
    setModalOpen(true);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#09175b]" /></div>;

  return (
    <div className="space-y-4">
      {message && <div className={cn("p-3 rounded-lg text-sm", message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{message.text}</div>}
      <div className="madm-card p-5">
        <h2 className="text-lg font-bold text-[#09175b] mb-4">Casos de Movimentação</h2>
        {casos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhum caso encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2">ID</th><th className="pb-2">Data</th><th className="pb-2">Solicitante</th>
                  <th className="pb-2">Cliente</th><th className="pb-2">Equipe</th><th className="pb-2">Assessor</th>
                  <th className="pb-2">Status</th><th className="pb-2">Obs.</th><th className="pb-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {casos.map(caso => (
                  <tr key={caso.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2">{caso.id}</td>
                    <td className="py-2 whitespace-nowrap">{new Date(caso.data_encaminhada).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2">{caso.solicitante}</td>
                    <td className="py-2">{`${caso.nome_cliente} ${caso.sobrenome_cliente}`}</td>
                    <td className="py-2">{caso.equipe_colaborador}</td>
                    <td className="py-2">{caso.nome_colaborador}</td>
                    <td className="py-2"><span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", caso.status === 'Concluído' ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600")}>{caso.status}</span></td>
                    <td className="py-2 max-w-xs truncate">{caso.observacao || "-"}</td>
                    <td className="py-2">
                      {caso.status !== 'Concluído' && (
                        <button onClick={() => abrirConclusao(caso)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Concluir</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modalOpen && selectedCaso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-[#09175b] mb-4">Concluir Caso #{selectedCaso.id}</h3>
            <p className="text-sm text-gray-600 mb-2">Cliente: {selectedCaso.nome_cliente} {selectedCaso.sobrenome_cliente}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4" placeholder="Adicione uma observação..." />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setModalOpen(false); setSelectedCaso(null); }} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleConcluir} className="px-4 py-2 text-sm bg-[#09175b] text-white rounded-lg hover:bg-[#1a2f8a]">Confirmar Conclusão</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-aba Movimentações (tickets com status "suporte")
function MovimentacoesSuporteTab() {
  const [tickets, setTickets] = useState<TicketMovimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);

  useEffect(() => {
    const carregarTickets = async () => {
      try {
        const res = await fetch(`${API_BASE}/suporte/tickets-movimentacao?status_mapeamento=suporte`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) setTickets(data.data);
        else setMessage({ text: "Erro ao carregar tickets de suporte", type: "error" });
      } catch (err) {
        setMessage({ text: "Erro ao carregar tickets de suporte", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    carregarTickets();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#09175b]" /></div>;

  return (
    <div className="space-y-4">
      {message && <div className={cn("p-3 rounded-lg text-sm", message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{message.text}</div>}
      <div className="madm-card p-5">
        <h2 className="text-lg font-bold text-[#09175b] mb-4">Tickets de Suporte (Movimentação)</h2>
        {tickets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhum ticket de suporte encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2">ID</th>
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Solicitante</th>
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2">Origem</th>
                  <th className="pb-2">Destino</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr key={ticket.id_ticket_movimentacao} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2">{ticket.id_ticket_movimentacao}</td>
                    <td className="py-2 whitespace-nowrap">{new Date(ticket.criado_em).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2">{ticket.colaborador_origem_nome}</td>
                    <td className="py-2">{`${ticket.nome_cliente_informado} ${ticket.sobrenome_cliente_informado}`}</td>
                    <td className="py-2">{ticket.equipe_origem_nome}</td>
                    <td className="py-2">{ticket.equipe_destino_nome} / {ticket.colaborador_destino_nome}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                        <AlertCircle className="w-3 h-3" /> Suporte
                      </span>
                    </td>
                    <td className="py-2 max-w-xs truncate">{ticket.observacao_sales_ops || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}