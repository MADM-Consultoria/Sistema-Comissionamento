// src/pages/Suporte.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
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

// ============================================================
// CONSTANTES DE EXCLUSÃO (mesmas do FilterBar)
// ============================================================
const EXCLUDED_TEAMS = [
  'Equipe SAC', 'Sales Ops', 'Equipe', 'Equipe Lucilene', 'Equipe SDR','Equipe Camila',
  'Equipe Erica', 'Equipe Lucas', 'Equipe Irene', 'Equipe Maria Eduarda', 'SalesOps',
  'Equipe Murilo Balsalobre', 'Comercial', 'Backoffice', 'CEO', 'Prontuário','BackOffice',
  'Equipe Leonardo Cardoso', 'Equipe Julia', 'Equipe Leticia', 'Dr. Felipe Marx','Administrativo',
  'Equipe Thales','Financeiro'
];

const EXCLUDED_GROUPS = [
  "Supervisor", "Coordenador", "Administrativo", "Salesops",
  "CEO", "Diretoria", "Desativado"
];

const normalize = (str: string): string =>
  (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const isExcludedTeam = (teamName: string): boolean => {
  if (!teamName) return false;
  const n = normalize(teamName);
  return EXCLUDED_TEAMS.some((t) => normalize(t) === n);
};

const isExcludedGroup = (group: string): boolean => {
  if (!group) return false;
  const n = normalize(group);
  return EXCLUDED_GROUPS.some((g) => normalize(g) === n);
};

const isDesativado = (c: any): boolean => {
  const grupo = normalize(c.grupo);
  const equipe = normalize(c.equipeNome);
  return grupo === 'desativado' || equipe.includes('desativado');
};

// ============================================================
// TIPOS
// ============================================================
interface MovementItem {
  id: string;
  timestamp: string;
  cliente: string;
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

// ============================================================
// HELPERS
// ============================================================
const formatPhoneDisplay = (phone: string): string => {
  const numbers = phone.replace(/\D/g, "");
  if (!numbers) return "";
  if (numbers.length === 13) return `+${numbers.slice(0,2)} (${numbers.slice(2,4)}) ${numbers.slice(4,9)}-${numbers.slice(9)}`;
  if (numbers.length === 12) return `+${numbers.slice(0,2)} (${numbers.slice(2,4)}) ${numbers.slice(4,8)}-${numbers.slice(8)}`;
  if (numbers.length === 11) return `(${numbers.slice(0,2)}) ${numbers.slice(2,7)}-${numbers.slice(7)}`;
  if (numbers.length === 10) return `(${numbers.slice(0,2)}) ${numbers.slice(2,6)}-${numbers.slice(6)}`;
  return numbers;
};

const formatCPF = (cpf: string): string => {
  const numbers = cpf.replace(/\D/g, "");
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0,3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0,3)}.${numbers.slice(3,6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0,3)}.${numbers.slice(3,6)}.${numbers.slice(6,9)}-${numbers.slice(9,11)}`;
};

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

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function Suporte() {
  const [activeTab, setActiveTab] = useState<"movimentacao" | "reportar">("reportar");

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
            aria-label="Aba de reportar problemas"
            title="Aba de reportar problemas"
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
            aria-label="Aba de movimentação de leads"
            title="Aba de movimentação de leads"
          >
            📋 Movimentar
          </button>
        </div>
      </div>

      {activeTab === "movimentacao" && <MovimentacaoTab />}
      {activeTab === "reportar" && <ReportarTab />}
    </DashboardLayout>
  );
}

// ============================================================
// ABA MOVIMENTAÇÃO (com restrições do FilterBar)
// ============================================================
function MovimentacaoTab() {
  const { equipeConfigs, collaborators, currentUser } = useAppStore();
  const { getAccessLevel, LEVELS } = useAccessControl();

  const userLevel = getAccessLevel();
  const isAssessor = userLevel === LEVELS.ASSESSOR;
  const isSupervisor = userLevel === LEVELS.SUPERVISAO;
  const isAdminOrCoord = userLevel >= LEVELS.COORDENADOR;

  // Estados do formulário
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [origem, setOrigem] = useState("");
  const [selectedEquipe, setSelectedEquipe] = useState("");
  const [selectedAssessor, setSelectedAssessor] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  // Carregar histórico do localStorage
  useEffect(() => {
    const stored = localStorage.getItem("madm_history_mock");
    if (stored) {
      try {
        setMovements(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("madm_history_mock", JSON.stringify(movements.slice(0, 100)));
  }, [movements]);

  // ========== LISTA DE EQUIPES (com restrições) ==========
  const equipeOptions = useMemo(() => {
    let nomes = equipeConfigs
      .map(eq => eq.nome)
      .filter(nome => !isExcludedTeam(nome));

    if (isSupervisor && currentUser?.equipe) {
      const userEquipeNorm = normalize(currentUser.equipe);
      nomes = nomes.filter(nome => normalize(nome) === userEquipeNorm);
    }
    if (isAssessor && currentUser?.equipe) {
      const userEquipeNorm = normalize(currentUser.equipe);
      nomes = nomes.filter(nome => normalize(nome) === userEquipeNorm);
    }
    return nomes.sort();
  }, [equipeConfigs, isSupervisor, isAssessor, currentUser]);

  // ========== COLABORADORES FILTRADOS POR EQUIPE ==========
  const assessorOptions = useMemo(() => {
    if (!collaborators.length) return [];

    let filtered = collaborators.filter(c => {
      if (isExcludedGroup(c.grupo)) return false;
      if (isDesativado(c)) return false;
      return true;
    });

    if (selectedEquipe) {
      filtered = filtered.filter(c => normalize(c.equipeNome) === normalize(selectedEquipe));
    }

    if (isAssessor && currentUser) {
      filtered = filtered.filter(c => c.id === currentUser.id);
    }

    return filtered.map(c => c.name).sort();
  }, [collaborators, selectedEquipe, isAssessor, isSupervisor, currentUser]);

  // ========== Sincronia ==========
  useEffect(() => {
    setSelectedAssessor("");
  }, [selectedEquipe]);

  useEffect(() => {
    if (isAssessor && currentUser?.equipe) {
      setSelectedEquipe(currentUser.equipe);
    }
  }, [isAssessor, currentUser]);

  // ========== SUBMIT ==========
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente.trim()) {
      setMessage({ text: "Nome do cliente é obrigatório", type: "error" });
      return;
    }
    if (!telefone && !cpf) {
      setMessage({ text: "Informe telefone ou CPF", type: "error" });
      return;
    }
    if (!selectedEquipe || !selectedAssessor) {
      setMessage({ text: "Selecione equipe e assessor", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    setTimeout(() => {
      const newMovement: MovementItem = {
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date().toISOString(),
        cliente: nomeCliente.trim(),
        telefone: telefone ? formatPhoneDisplay(telefone) : "Não informado",
        cpf: cpf ? formatCPF(cpf) : "Não informado",
        origem: origem || "Não informada",
        equipe: selectedEquipe,
        assessor: selectedAssessor,
        status: "pendente",
        resultado: "Movimentação registrada. Aguardando processamento.",
        usuario: currentUser?.name || "Usuário",
        atualizadoEm: new Date().toISOString(),
      };
      setMovements(prev => [newMovement, ...prev]);
      setMessage({ text: "Movimentação registrada com sucesso!", type: "success" });
      setNomeCliente("");
      setTelefone("");
      setCpf("");
      setOrigem("");
      setSelectedEquipe(isAssessor ? currentUser?.equipe || "" : "");
      setSelectedAssessor("");
      setLoading(false);
    }, 800);
  };

  const filteredMovements = movements.filter(m => filterStatus === "todos" || m.status === filterStatus);
  const statusOptions = ["todos", "pendente", "processando", "concluido", "suporte", "aviso", "erro"];

  const exportHistory = () => {
    if (movements.length === 0) return;
    const headers = ["Data/Hora","Cliente","Telefone","CPF","Equipe","Assessor","Status","Resultado"];
    const rows = movements.map(m => [
      new Date(m.timestamp).toLocaleString("pt-BR"),
      `"${m.cliente.replace(/"/g, '""')}"`,
      `"${m.telefone.replace(/"/g, '""')}"`,
      `"${m.cpf.replace(/"/g, '""')}"`,
      `"${m.equipe.replace(/"/g, '""')}"`,
      `"${m.assessor.replace(/"/g, '""')}"`,
      `"${getStatusInfo(m.status).label.replace(/"/g, '""')}"`,
      `"${(m.resultado || "").replace(/"/g, '""')}"`,
    ].join(";"));
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
    if (confirm("Limpar todo o histórico de movimentações?")) {
      setMovements([]);
      localStorage.removeItem("madm_history_mock");
      setMessage({ text: "Histórico limpo.", type: "success" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="madm-card p-5">
        <h2 className="text-lg font-bold text-[#09175b] mb-4">Nova Movimentação</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mov-nomeCliente" className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Cliente *
              </label>
              <input
                type="text"
                id="mov-nomeCliente"
                value={nomeCliente}
                onChange={e => setNomeCliente(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#09175b] focus:border-[#09175b]"
                placeholder="Digite o nome completo"
                title="Nome do cliente"
              />
            </div>
            <div>
              <label htmlFor="mov-origem" className="block text-sm font-medium text-gray-700 mb-1">
                Origem do Lead
              </label>
              <select
                id="mov-origem"
                value={origem}
                onChange={e => setOrigem(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                title="Selecione a origem do lead"
              >
                <option value="">Selecionar origem</option>
                <option value="cat">CAT</option>
                <option value="indicacao">Indicação</option>
                <option value="trafego_pago">Marketing</option>
              </select>
            </div>
            <div>
              <label htmlFor="mov-telefone" className="block text-sm font-medium text-gray-700 mb-1">
                Telefone
              </label>
              <input
                type="tel"
                id="mov-telefone"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                onBlur={() => telefone && setTelefone(formatPhoneDisplay(telefone))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="(11) 99999-9999"
                title="Número de telefone"
              />
            </div>
            <div>
              <label htmlFor="mov-cpf" className="block text-sm font-medium text-gray-700 mb-1">
                CPF
              </label>
              <input
                type="text"
                id="mov-cpf"
                value={cpf}
                onChange={e => setCpf(e.target.value)}
                onBlur={() => cpf && setCpf(formatCPF(cpf))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="000.000.000-00"
                title="CPF do cliente"
              />
            </div>
            <div>
              <label htmlFor="mov-equipe" className="block text-sm font-medium text-gray-700 mb-1">
                Equipe *
              </label>
              <select
                id="mov-equipe"
                value={selectedEquipe}
                onChange={e => setSelectedEquipe(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
                disabled={isAssessor}
                title={isAssessor ? "Sua equipe é fixa" : "Selecione a equipe para movimentação"}
              >
                <option value="">Selecione uma equipe</option>
                {equipeOptions.map(eq => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mov-assessor" className="block text-sm font-medium text-gray-700 mb-1">
                Assessor *
              </label>
              <select
                id="mov-assessor"
                value={selectedAssessor}
                onChange={e => setSelectedAssessor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
                disabled={isAssessor}
                title={isAssessor ? "Você só pode selecionar a si mesmo" : "Selecione o assessor responsável"}
              >
                <option value="">Selecione um assessor</option>
                {assessorOptions.map(nome => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </select>
              {isAssessor && selectedAssessor && (
                <p className="text-xs text-gray-400 mt-1">Você só pode movimentar para você mesmo.</p>
              )}
            </div>
          </div>
          {message && (
            <div className={cn("p-3 rounded-lg text-sm", message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
              {message.text}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#09175b] text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#1a2f8a] transition-colors disabled:opacity-50"
              title="Registrar movimentação"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? "Enviando..." : "Registrar Movimentação"}
            </button>
          </div>
        </form>
      </div>

      <div className="madm-card p-5">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <h2 className="text-lg font-bold text-[#09175b]">Histórico de Movimentações</h2>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
              title="Filtrar movimentações por status"
              aria-label="Filtrar movimentações por status"
            >
              {statusOptions.map(s => <option key={s} value={s}>{s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <button
              type="button"
              onClick={exportHistory}
              className="text-sm bg-gray-100 px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-200"
              title="Exportar histórico para CSV"
              aria-label="Exportar histórico para CSV"
            >
              <Download className="w-3 h-3" /> Exportar
            </button>
            <button
              type="button"
              onClick={clearHistory}
              className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded flex items-center gap-1 hover:bg-red-100"
              title="Limpar todo o histórico"
              aria-label="Limpar todo o histórico"
            >
              <Trash2 className="w-3 h-3" /> Limpar
            </button>
          </div>
        </div>
        {filteredMovements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhuma movimentação registrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2">Data/Hora</th>
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2">Contato</th>
                  <th className="pb-2">Equipe/Assessor</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map(m => {
                  const statusInfo = getStatusInfo(m.status);
                  return (
                    <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 whitespace-nowrap">{new Date(m.timestamp).toLocaleString("pt-BR")}</td>
                      <td className="py-2">{m.cliente}</td>
                      <td className="py-2"><div>{m.telefone}</div><small className="text-gray-400">{m.cpf}</small></td>
                      <td className="py-2"><div>{m.equipe}</div><small>{m.assessor}</small></td>
                      <td className="py-2"><span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", statusInfo.className)}>{statusInfo.icon} {statusInfo.label}</span></td>
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

// ============================================================
// ABA REPORTAR
// ============================================================
function ReportarTab() {
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  useEffect(() => {
    const stored = localStorage.getItem("madm_reportes_mock");
    if (stored) {
      try {
        setReports(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("madm_reportes_mock", JSON.stringify(reports.slice(0, 50)));
  }, [reports]);

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
        descricaoResumida: descricao.length > 200 ? descricao.substring(0,200)+"..." : descricao,
        solicitante: "Usuário",
        equipe: "Equipe Demo",
        status: "ENVIADO",
        ultimaAtualizacao: new Date().toISOString(),
      };
      setReports(prev => [newReport, ...prev]);
      setMessage({ text: "Reporte registrado com sucesso!", type: "success" });
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
    const headers = ["ID","Data","Assunto","Descrição","Solicitante","Equipe","Status"];
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
      localStorage.removeItem("madm_reportes_mock");
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
            <label htmlFor="rep-assunto" className="block text-sm font-medium text-gray-700 mb-1">
              Assunto
            </label>
            <select
              id="rep-assunto"
              value={assunto}
              onChange={e => setAssunto(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
              title="Selecione o assunto do problema"
            >
              <option value="">Selecionar assunto</option>
              <option value="Discadora">Discadora</option>
              <option value="Kommo">Kommo</option>
              <option value="Dash">Dash</option>
              <option value="Acesso">Acessos</option>
              <option value="Reversao">Reversão</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label htmlFor="rep-descricao" className="block text-sm font-medium text-gray-700 mb-1">
              Descrição Detalhada
            </label>
            <textarea
              id="rep-descricao"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Descreva o problema com detalhes..."
              required
              title="Descrição detalhada do problema"
            />
            <div className="text-right text-xs text-gray-400 mt-1">{descricao.length}/1000 caracteres</div>
          </div>
          <div>
            <label htmlFor="reportar-arquivos" className="block text-sm font-medium text-gray-700 mb-1">
              Anexar Arquivos
            </label>
            <input
              type="file"
              id="reportar-arquivos"
              multiple
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:bg-gray-100 hover:file:bg-gray-200"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              title="Selecione arquivos para anexar ao reporte"
            />
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                    <span className="truncate">{f.name} ({(f.size/1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-red-500 hover:text-red-700"
                      title="Remover arquivo"
                      aria-label={`Remover arquivo ${f.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {message && (
            <div className={cn("p-3 rounded-lg text-sm", message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
              {message.text}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#09175b] text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#1a2f8a] transition-colors disabled:opacity-50"
              title="Enviar reporte"
            >
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
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
              title="Filtrar reportes por status"
              aria-label="Filtrar reportes por status"
            >
              {statusOptions.map(s => <option key={s} value={s}>{s === "todos" ? "Todos" : s}</option>)}
            </select>
            <button
              type="button"
              onClick={exportReports}
              className="text-sm bg-gray-100 px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-200"
              title="Exportar reportes para CSV"
              aria-label="Exportar reportes para CSV"
            >
              <Download className="w-3 h-3" /> Exportar
            </button>
            <button
              type="button"
              onClick={clearReports}
              className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded flex items-center gap-1 hover:bg-red-100"
              title="Limpar todos os reportes"
              aria-label="Limpar todos os reportes"
            >
              <Trash2 className="w-3 h-3" /> Limpar
            </button>
            <button
              type="button"
              onClick={updateAllReportsStatus}
              className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded flex items-center gap-1 hover:bg-blue-100"
              title="Atualizar status dos reportes (simulação)"
              aria-label="Atualizar status dos reportes (simulação)"
            >
              <RefreshCw className="w-3 h-3" /> Atualizar Status
            </button>
          </div>
        </div>
        {filteredReports.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhum reporte enviado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Assunto</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Ações</th>
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
                        <button
                          type="button"
                          onClick={() => viewDetails(r)}
                          className="text-blue-600 hover:text-blue-800"
                          title={`Ver detalhes do reporte ${r.id}`}
                          aria-label={`Ver detalhes do reporte ${r.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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