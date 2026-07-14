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

// ---------------------- Componente principal ----------------------
export default function Suporte() {
  const [activeTab, setActiveTab] = useState<"movimentacao" | "reportar" | "salesops">("reportar");
  const { getAccessLevel, LEVELS } = useAccessControl();

  // Somente Coordenador e Administrativo (SalesOps, CEO, Diretoria) têm acesso à Visão SalesOps
  const isAdmin = useMemo(() => {
    const level = getAccessLevel();
    return level === LEVELS.ADMINISTRATIVO || level === LEVELS.COORDENADOR;
  }, [getAccessLevel, LEVELS]);

  return (
    <DashboardLayout title="Suporte Operacional" subtitle="Movimentação de leads e reporte de problemas">
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("reportar")}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors",
              activeTab === "reportar"
                ? "bg-white text-[#09175b] border-b-2 border-[#09175b]"
                : "text-gray-500 hover:text-gray-700"
            )}
            title="Aba Reportar"
          >
            🔍 Reportar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("movimentacao")}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors",
              activeTab === "movimentacao"
                ? "bg-white text-[#09175b] border-b-2 border-[#09175b]"
                : "text-gray-500 hover:text-gray-700"
            )}
            title="Aba Movimentação"
          >
            📋 Movimentar
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("salesops")}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors",
                activeTab === "salesops"
                  ? "bg-white text-[#09175b] border-b-2 border-[#09175b]"
                  : "text-gray-500 hover:text-gray-700"
              )}
              title="Visão SalesOps"
            >
              📊 Visão SalesOps
            </button>
          )}
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
    addNotification,
    notifications,
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

  const [kommoMovements, setKommoMovements] = useState<MovementItem[]>([]);
  const [hubspotMovements, setHubspotMovements] = useState<MovementItem[]>([]);
  const [platform, setPlatform] = useState<"kommo" | "hubspot">("kommo");

  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const currentMovements = platform === "kommo" ? kommoMovements : hubspotMovements;

  // ========== EQUIPES ==========
  const equipesDisponiveis = useMemo(() => {
    if (!equipeConfigs || equipeConfigs.length === 0) return [];
    return equipeConfigs.map(eq => eq.nome).filter(nome => !isExcludedTeam(nome));
  }, [equipeConfigs]);

  useEffect(() => {
    if (equipeConfigs.length === 0) loadEquipeConfigs();
  }, [equipeConfigs, loadEquipeConfigs]);

  // ========== COLABORADORES ==========
  const [loadingColaboradores, setLoadingColaboradores] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const carregar = async () => {
      if (collaborators.length === 0) {
        try {
          await loadCollaborators();
        } catch (error) {
          console.error("Falha ao carregar colaboradores:", error);
        }
      }
      if (isMounted) {
        setLoadingColaboradores(false);
      }
    };
    carregar();
    return () => { isMounted = false; };
  }, []);

  // ========== ASSESSORES ==========
  const assessoresDisponiveis = useMemo(() => {
    if (!collaborators.length) return [];
    let filtered = collaborators.filter(c => !isExcludedTeam(c.equipeNome));
    if (equipe) {
      filtered = filtered.filter(c => normalize(c.equipeNome) === normalize(equipe));
    }
    return filtered.map(c => ({ id: c.id.toString(), nome: c.name }));
  }, [collaborators, equipe]);

  useEffect(() => {
    if (assessorId) {
      const assessor = assessoresDisponiveis.find(a => a.id === assessorId);
      if (!assessor) {
        setAssessorId("");
      }
    }
  }, [assessoresDisponiveis, assessorId]);

  // ========== VERIFICAÇÃO DE TOKEN ==========
  useEffect(() => {
    let intervalId: number;
    const checkToken = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/token-status`, { credentials: 'include' });
        if (!res.ok) return;
        const status = await res.json();
        if (status.expiresSoon) {
          const jaExiste = notifications.some(
            n => n.title === "Token Kommo expirando" &&
            (Date.now() - new Date(n.time).getTime() < 3600000)
          );
          if (!jaExiste) {
            addNotification({
              id: Date.now(),
              type: 'warning',
              title: "Token Kommo expirando",
              message: "O token de acesso ao Kommo expirará em menos de 1 hora. Renove-o para evitar falhas nas movimentações.",
              action: "Verificar",
              time: new Date().toISOString(),
              read: false,
            });
          }
        }
      } catch { }
    };
    checkToken();
    intervalId = window.setInterval(checkToken, 60000);
    return () => clearInterval(intervalId);
  }, [notifications, addNotification]);

  // ========== ENVIO ==========
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (platform === "hubspot") {
      setMessage({ text: "Integração com HubSpot em desenvolvimento. Nenhuma movimentação foi realizada.", type: "error" });
      return;
    }

    if (!firstName.trim()) { setMessage({ text: "Nome é obrigatório", type: "error" }); return; }
    if (!lastName.trim()) { setMessage({ text: "Sobrenome é obrigatório", type: "error" }); return; }
    if (!email.trim()) { setMessage({ text: "E-mail é obrigatório", type: "error" }); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setMessage({ text: "E-mail inválido", type: "error" }); return; }
    if (!equipe || !assessorId) { setMessage({ text: "Selecione equipe e assessor", type: "error" }); return; }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/suporte/movimentar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          telefone: telefone || undefined,
          cpf: cpf || undefined,
          origem: origem || undefined,
          equipeNome: equipe,
          assessorId,
          usuario: currentUser?.name || currentUser?.email || 'frontend',
        }),
      });
      if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
      const result = await response.json();
      const assessorNome = assessoresDisponiveis.find(a => a.id === assessorId)?.nome || assessorId;
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      const newMovement: MovementItem = {
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date().toISOString(),
        cliente: fullName,
        email: email.trim(),
        telefone: telefone ? formatPhoneDisplay(telefone) : "Não informado",
        cpf: cpf ? formatCPF(cpf) : "Não informado",
        origem: origem || "Não informada",
        equipe,
        assessor: assessorNome,
        status: (result.status === 'concluido' ? 'concluido' : result.status === 'suporte' ? 'suporte' : result.status === 'erro' ? 'erro' : result.status === 'aviso' ? 'aviso' : 'pendente'),
        resultado: result.message || `Movimentação processada via Kommo`,
        usuario: currentUser?.name || 'demo',
        atualizadoEm: new Date().toISOString(),
      };

      setKommoMovements(prev => [newMovement, ...prev]);
      setMessage({ text: result.message || "Movimentação processada", type: result.success ? "success" : "error" });

      if (result.success) {
        // Registrar no banco de dados local
        fetch(`${API_BASE}/suporte/registrar-movimentacao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            Solicitante: currentUser?.name || 'frontend',
            Nome_Cliente: firstName.trim(),
            Sobrenome_Cliente: lastName.trim(),
            Email_Cliente: email.trim(),
            Numero_Cliente: telefone || null,
            CPF_Cliente: cpf || null,
            Origem_Cliente: origem || null,
            Nome_Colaborador: assessorNome,
            Equipe_Colaborador: equipe,
            Status: result.status,
          }),
        }).catch(err => console.warn('Falha ao registrar no banco:', err));

        setFirstName(""); setLastName(""); setEmail(""); setTelefone(""); setCpf(""); setOrigem(""); setEquipe(""); setAssessorId("");
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Erro na movimentação", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // ========== FILTROS E EXPORTAÇÃO ==========
  const filteredMovements = currentMovements.filter(m => filterStatus === "todos" || m.status === filterStatus);
  const statusOptions = ["todos", "pendente", "processando", "concluido", "suporte", "aviso", "erro"];

  const exportHistory = () => {
    if (currentMovements.length === 0) return;
    const headers = ["Data/Hora", "Cliente", "E-mail", "Telefone", "CPF", "Equipe", "Assessor", "Status", "Resultado"];
    const rows = currentMovements.map(m =>
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
    a.download = `movimentacoes_${platform}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = () => {
    if (confirm(`Limpar todo o histórico de ${platform === "kommo" ? "Kommo" : "HubSpot"}?`)) {
      if (platform === "kommo") setKommoMovements([]);
      else setHubspotMovements([]);
      setMessage({ text: `Histórico de ${platform === "kommo" ? "Kommo" : "HubSpot"} limpo.`, type: "success" });
    }
  };

  // ========== RENDER ==========
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Toggle de plataforma */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Plataforma:</span>
        <div className="flex items-center bg-gray-200 p-1 rounded-full">
          {platform === "kommo" ? (
            <button
              type="button"
              className="px-4 py-1 rounded-full text-sm font-medium transition-all bg-white shadow text-[#09175b]"
              title="Plataforma Kommo (selecionada)"
              aria-pressed="true"
            >
              Kommo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPlatform("kommo")}
              className="px-4 py-1 rounded-full text-sm font-medium transition-all text-gray-600 hover:text-gray-800"
              title="Selecionar plataforma Kommo"
              aria-pressed="false"
            >
              Kommo
            </button>
          )}

          {platform === "hubspot" ? (
            <button
              type="button"
              className="px-4 py-1 rounded-full text-sm font-medium transition-all bg-white shadow text-[#09175b]"
              title="Plataforma HubSpot (em desenvolvimento, selecionada)"
              aria-pressed="true"
            >
              HubSpot
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPlatform("hubspot")}
              className="px-4 py-1 rounded-full text-sm font-medium transition-all text-gray-600 hover:text-gray-800"
              title="Selecionar plataforma HubSpot (em desenvolvimento)"
              aria-pressed="false"
            >
              HubSpot
            </button>
          )}
        </div>
      </div>

      {/* Banner HubSpot */}
      {platform === "hubspot" && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>A integração com HubSpot está em desenvolvimento. As movimentações estão bloqueadas.</span>
        </div>
      )}

      {/* Formulário */}
      <div className="madm-card p-5">
        <h2 className="text-lg font-bold text-[#09175b] mb-4">
          Movimentação de Leads – {platform === "kommo" ? "Kommo" : "HubSpot"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mov-firstName" className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input type="text" id="mov-firstName" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required title="Nome do cliente" aria-label="Nome do cliente" />
            </div>
            <div>
              <label htmlFor="mov-lastName" className="block text-sm font-medium text-gray-700 mb-1">Sobrenome *</label>
              <input type="text" id="mov-lastName" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required title="Sobrenome do cliente" aria-label="Sobrenome do cliente" />
            </div>
            <div>
              <label htmlFor="mov-email" className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
              <input type="email" id="mov-email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required title="E-mail do cliente" aria-label="E-mail do cliente" />
            </div>
            <div>
              <label htmlFor="mov-origem" className="block text-sm font-medium text-gray-700 mb-1">Origem do Lead</label>
              <select id="mov-origem" value={origem} onChange={e => setOrigem(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" title="Selecione a origem do lead" aria-label="Selecione a origem do lead">
                <option value="">Selecionar origem</option>
                <option value="cat">CAT</option>
                <option value="indicacao">Indicação</option>
                <option value="trafego_pago">Marketing</option>
              </select>
            </div>
            <div>
              <label htmlFor="mov-telefone" className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input type="tel" id="mov-telefone" value={telefone} onChange={e => setTelefone(e.target.value)} onBlur={() => telefone && setTelefone(formatPhoneDisplay(telefone))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" title="Número de telefone" aria-label="Número de telefone" />
            </div>
            <div>
              <label htmlFor="mov-cpf" className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
              <input type="text" id="mov-cpf" value={cpf} onChange={e => setCpf(e.target.value)} onBlur={() => cpf && setCpf(formatCPF(cpf))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" title="CPF do cliente" aria-label="CPF do cliente" />
            </div>
            <div>
              <label htmlFor="mov-equipe" className="block text-sm font-medium text-gray-700 mb-1">Equipe *</label>
              <select id="mov-equipe" value={equipe} onChange={e => setEquipe(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required title="Selecione a equipe" aria-label="Selecione a equipe">
                <option value="">Selecione uma equipe</option>
                {equipesDisponiveis.map(nome => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="mov-assessor" className="block text-sm font-medium text-gray-700 mb-1">Assessor *</label>
              <select id="mov-assessor" value={assessorId} onChange={e => setAssessorId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required title="Selecione o assessor" aria-label="Selecione o assessor">
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
            <button
              type="submit"
              disabled={loading || platform === "hubspot" || loadingColaboradores}
              className="bg-[#09175b] text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#1a2f8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={platform === "hubspot" ? "Integração com HubSpot em desenvolvimento" : "Registrar movimentação"}
              aria-label={platform === "hubspot" ? "Movimentação bloqueada (em desenvolvimento)" : "Registrar movimentação"}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : platform === "hubspot" ? (
                <Clock className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Send className="w-4 h-4" aria-hidden="true" />
              )}
              {loading ? "Enviando..." : platform === "hubspot" ? "Em desenvolvimento" : "Registrar Movimentação"}
            </button>
          </div>
        </form>
      </div>

      {/* Histórico */}
      <div className="madm-card p-5">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <h2 className="text-lg font-bold text-[#09175b]">Histórico de Movimentações – {platform === "kommo" ? "Kommo" : "HubSpot"}</h2>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
              title="Filtrar por status"
              aria-label="Filtrar movimentações por status"
            >
              {statusOptions.map(s => <option key={s} value={s}>{s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <button onClick={exportHistory} className="text-sm bg-gray-100 px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-200" title="Exportar histórico para CSV" aria-label="Exportar histórico para CSV"><Download className="w-3 h-3" aria-hidden="true" /> Exportar</button>
            <button onClick={clearHistory} className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded flex items-center gap-1 hover:bg-red-100" title="Limpar todo o histórico" aria-label="Limpar todo o histórico"><Trash2 className="w-3 h-3" aria-hidden="true" /> Limpar</button>
          </div>
        </div>
        {filteredMovements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhuma movimentação registrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" summary="Histórico de movimentações de leads">
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
                      <td className="py-2"><span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", info.className)} aria-label={`Status: ${info.label}`}>{info.icon} {info.label}</span></td>
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

  const handleSubmit = (e: React.FormEvent) => {
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

    setTimeout(() => {
      const newReport: ReportItem = {
        id: `REP_${Date.now()}`,
        data: new Date().toISOString(),
        assunto,
        descricao,
        descricaoResumida: descricao.length > 200 ? descricao.substring(0, 200) + "..." : descricao,
        solicitante: "Usuário Demo",
        equipe: "Equipe Demo",
        status: "ENVIADO",
        ultimaAtualizacao: new Date().toISOString(),
      };
      setReports(prev => [newReport, ...prev]);
      setMessage({ text: "Reporte registrado (modo demo).", type: "success" });
      setAssunto("");
      setDescricao("");
      setFiles([]);
      const fileInput = document.getElementById("reportar-arquivos") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      setLoading(false);
    }, 800);
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
    setReports(prev => prev.map(r => ({
      ...r,
      status: r.status === "ENVIADO" ? "CONCLUÍDO" : r.status,
      ultimaAtualizacao: new Date().toISOString(),
    })));
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
            <select id="rep-assunto" value={assunto} onChange={e => setAssunto(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required title="Selecione o assunto do problema" aria-label="Selecione o assunto do problema">
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
            <textarea id="rep-descricao" value={descricao} onChange={e => setDescricao(e.target.value)} rows={5} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required title="Descrição detalhada do problema" aria-label="Descrição detalhada do problema" />
            <div className="text-right text-xs text-gray-400 mt-1">{descricao.length}/1000 caracteres</div>
          </div>
          <div>
            <label htmlFor="reportar-arquivos" className="block text-sm font-medium text-gray-700 mb-1">Anexar Arquivos</label>
            <input type="file" id="reportar-arquivos" multiple onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:bg-gray-100 hover:file:bg-gray-200" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" title="Selecione arquivos para anexar" aria-label="Selecione arquivos para anexar" />
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                    <span className="truncate">{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                    <button type="button" onClick={() => removeFile(idx)} className="text-red-500 hover:text-red-700" title="Remover arquivo" aria-label={`Remover arquivo ${f.name}`}><X className="w-4 h-4" aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {message && (
            <div className={cn("p-3 rounded-lg text-sm", message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")} role="status" aria-live="polite">{message.text}</div>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="bg-[#09175b] text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#1a2f8a] transition-colors disabled:opacity-50" title="Enviar reporte" aria-label="Enviar reporte">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
              {loading ? "Enviando..." : "Enviar Reporte"}
            </button>
          </div>
        </form>
      </div>

      <div className="madm-card p-5">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <h2 className="text-lg font-bold text-[#09175b]">Meus Reportes</h2>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1 border rounded text-sm" title="Filtrar reportes por status" aria-label="Filtrar reportes por status">
              {statusOptions.map(s => <option key={s} value={s}>{s === "todos" ? "Todos" : s}</option>)}
            </select>
            <button type="button" onClick={exportReports} className="text-sm bg-gray-100 px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-200" title="Exportar reportes para CSV" aria-label="Exportar reportes para CSV"><Download className="w-3 h-3" aria-hidden="true" /> Exportar</button>
            <button type="button" onClick={clearReports} className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded flex items-center gap-1 hover:bg-red-100" title="Limpar todos os reportes" aria-label="Limpar todos os reportes"><Trash2 className="w-3 h-3" aria-hidden="true" /> Limpar</button>
            <button type="button" onClick={updateAllReportsStatus} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded flex items-center gap-1 hover:bg-blue-100" title="Atualizar status dos reportes (simulação)" aria-label="Atualizar status dos reportes"><RefreshCw className="w-3 h-3" aria-hidden="true" /> Atualizar Status</button>
          </div>
        </div>
        {filteredReports.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhum reporte enviado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" summary="Lista de reportes enviados">
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
                      <td className="py-2"><span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", statusInfo.className)} aria-label={`Status: ${statusInfo.label}`}>{statusInfo.icon} {statusInfo.label}</span></td>
                      <td className="py-2">
                        <button type="button" onClick={() => viewDetails(r)} className="text-blue-600 hover:text-blue-800" title="Ver detalhes do reporte" aria-label={`Ver detalhes do reporte ${r.id}`}><Eye className="w-4 h-4" aria-hidden="true" /></button>
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

// ---------------------- Visão SalesOps ----------------------
function SalesOpsTab() {
  const [casos, setCasos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCaso, setSelectedCaso] = useState<any>(null);
  const [observacao, setObservacao] = useState("");
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);

  // Carregar casos ao montar
  useEffect(() => {
    const carregarCasos = async () => {
      try {
        const res = await fetch(`${API_BASE}/suporte/casos`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) setCasos(data.data);
        else setMessage({ text: "Erro ao carregar casos", type: "error" });
      } catch (err) {
        console.error(err);
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
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ observacao }),
      });
      const data = await res.json();
      if (data.success) {
        // Atualiza lista localmente
        setCasos(prev => prev.map(c =>
          c.id === selectedCaso.id ? { ...c, status: 'Concluído', data_conclusao: new Date().toISOString().split('T')[0], observacao } : c
        ));
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#09175b]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {message && (
        <div className={cn("p-3 rounded-lg text-sm", message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")} role="status" aria-live="polite">
          {message.text}
        </div>
      )}

      <div className="madm-card p-5">
        <h2 className="text-lg font-bold text-[#09175b] mb-4">Casos de Movimentação (SalesOps)</h2>
        {casos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhum caso encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2">ID</th>
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Solicitante</th>
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2">Equipe</th>
                  <th className="pb-2">Assessor</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Observação</th>
                  <th className="pb-2">Ações</th>
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
                    <td className="py-2">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        caso.status === 'Concluído' ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                      )}>
                        {caso.status}
                      </span>
                    </td>
                    <td className="py-2 max-w-xs truncate">{caso.observacao || "-"}</td>
                    <td className="py-2">
                      {caso.status !== 'Concluído' && (
                        <button
                          onClick={() => abrirConclusao(caso)}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          title="Concluir caso"
                          aria-label={`Concluir caso ${caso.id}`}
                        >
                          <CheckCircle className="w-4 h-4" /> Concluir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de conclusão */}
      {modalOpen && selectedCaso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-[#09175b] mb-4">Concluir Caso #{selectedCaso.id}</h3>
            <p className="text-sm text-gray-600 mb-2">
              Cliente: {selectedCaso.nome_cliente} {selectedCaso.sobrenome_cliente}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              placeholder="Adicione uma observação..."
              aria-label="Observação sobre a conclusão do caso"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setModalOpen(false); setSelectedCaso(null); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConcluir}
                className="px-4 py-2 text-sm bg-[#09175b] text-white rounded-lg hover:bg-[#1a2f8a]"
              >
                Confirmar Conclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}