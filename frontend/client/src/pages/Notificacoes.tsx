// src/pages/Notifications.tsx
import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAppStore } from "@/lib/dataStore";
import { useAccessControl } from "@/hooks/useAccessControl";
import {
  AlertTriangle, TrendingDown, CheckCircle, Info,
  Bell, BellOff, ArrowRight, Zap, Clock, Users, Target, DollarSign,
  Send, BookOpen, ImagePlus, X, Trash2, Pencil, Save,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Notif = ReturnType<typeof useAppStore.getState>['notifications'][number];

const iconMap: Record<string, React.ElementType> = {
  AlertTriangle, TrendingDown, CheckCircle, Info,
  Bell, BellOff, ArrowRight, Zap, Clock, Users, Target, DollarSign,
  Send, BookOpen, ImagePlus, X, Trash2, Pencil, Save, Maximize2,
};

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  warning:    { icon: AlertTriangle, color: "#f59e0b", bg: "#fffbeb",   border: "#fde68a", label: "Atenção" },
  danger:     { icon: TrendingDown,  color: "#ef4444", bg: "#fef2f2",   border: "#fecaca", label: "Urgente" },
  success:    { icon: CheckCircle,   color: "#34a853", bg: "#f0fdf4",   border: "#bbf7d0", label: "Sucesso" },
  info:       { icon: Info,          color: "#09175b", bg: "#eff6ff",   border: "#bfdbfe", label: "Informativo" },
  orientacao: { icon: BookOpen,      color: "#6366f1", bg: "#f5f3ff",   border: "#c7d2fe", label: "Orientação" },
};

export default function Notificacoes() {
  const [filter, setFilter] = useState("todos");

  const {
    notifications,
    insightCards,
    markNotificationRead,
    markAllNotificationsRead,
    addNotification,
    setNotifications,
    currentUser,
    equipeConfigs,
  } = useAppStore();

  const { getAccessLevel, LEVELS } = useAccessControl();
  const userLevel = getAccessLevel();

  const isSupervisor = userLevel === LEVELS.SUPERVISAO;
  const canSend = userLevel >= LEVELS.SUPERVISAO;
  const canSendToAll = userLevel >= LEVELS.COORDENADOR;
  const canManage = userLevel >= LEVELS.COORDENADOR;

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "danger" | "success" | "orientacao">("info");
  const [targetTeam, setTargetTeam] = useState<string>("todos");
  const [sending, setSending] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    message: "",
    type: "info" as "info" | "warning" | "danger" | "success" | "orientacao",
    images: [] as string[],
  });

  // Estado para o modal de imagem ampliada
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const teamOptions = equipeConfigs.map(eq => eq.nome);

  const filtered = notifications.filter((n) => {
    if (filter === "nao_lidas") return !n.read;
    if (filter !== "todos" && n.type !== filter) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Handlers de leitura
  const handleMarkAllRead = () => { markAllNotificationsRead(); toast.success("Todas lidas"); };
  const handleMarkRead = (id: number) => markNotificationRead(id);
  const handleInsightAction = (action: string, title: string) => toast.info(`Abrindo: ${action}`);
  const handleNotificationAction = (action: string, title: string, e: React.MouseEvent) => { e.stopPropagation(); toast.info(`Abrindo: ${action}`); };

  // Upload de imagens (envio)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} não é imagem`); return; }
      const reader = new FileReader();
      reader.onload = (ev) => { const base64 = ev.target?.result as string; setImages(prev => [...prev, base64]); };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

  // Envio de notificação
  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Preencha título e mensagem"); return; }
    setSending(true);
    try {
      addNotification({
        id: Date.now(),
        type,
        title: title.trim(),
        message: message.trim(),
        action: targetTeam === "todos" ? "Todos" : `Equipe ${targetTeam}`,
        time: new Date().toLocaleString("pt-BR"),
        read: false,
        images: images.length > 0 ? [...images] : undefined,
      });
      toast.success("Notificação enviada!");
      setTitle(""); setMessage(""); setType("info"); setImages([]);
      if (canSendToAll) setTargetTeam("todos");
    } catch { toast.error("Erro ao enviar"); }
    finally { setSending(false); }
  };

  // Excluir notificação
  const handleDelete = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
    toast.success("Excluída");
    if (editingId === id) setEditingId(null);
  };

  // Iniciar edição
  const startEdit = (notif: Notif) => {
    setEditingId(notif.id);
    setEditForm({
      title: notif.title,
      message: notif.message,
      type: notif.type,
      images: notif.images || [],
    });
  };
  const cancelEdit = () => setEditingId(null);

  // Salvar edição
  const saveEdit = () => {
    if (!editingId) return;
    setNotifications(notifications.map(n => n.id === editingId ? { ...n, title: editForm.title.trim(), message: editForm.message.trim(), type: editForm.type, images: editForm.images } : n));
    toast.success("Atualizada"); setEditingId(null);
  };

  // Upload de imagens na edição
  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} não é imagem`); return; }
      const reader = new FileReader();
      reader.onload = (ev) => { const base64 = ev.target?.result as string; setEditForm(prev => ({ ...prev, images: [...prev.images, base64] })); };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeEditImage = (index: number) => setEditForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));

  return (
    <DashboardLayout title="Notificações e Insights" subtitle="Alertas inteligentes para você agir no momento certo">
      {/* ========== FORMULÁRIO DE ENVIO ========== */}
      {canSend && (
        <div className="madm-card p-5 mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-4 h-4 text-[#09175b]" />
            <h3 className="text-sm font-bold text-[#09175b]">Enviar Notificação</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="notif-title" className="block text-xs font-medium text-gray-600 mb-1">Título</label>
                <input id="notif-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200" placeholder="Título da notificação" title="Título da notificação" />
              </div>
              <div>
                <label htmlFor="notif-type" className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select id="notif-type" value={type} onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white" title="Tipo de notificação">
                  <option value="info">Informativo</option>
                  <option value="orientacao">Orientação</option>
                  <option value="success">Sucesso</option>
                  <option value="warning">Aviso</option>
                  <option value="danger">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="notif-message" className="block text-xs font-medium text-gray-600 mb-1">Descricao</label>
              <textarea id="notif-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200" placeholder="Conteúdo da notificação" title="Conteúdo da notificação" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Anexar imagens</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img src={img} alt={`Anexo ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border" />
                    <button onClick={() => removeImage(idx)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Remover imagem"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-16 h-16 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-[#09175b] transition-colors" title="Adicionar imagem"><ImagePlus className="w-5 h-5 text-gray-400" /></button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" title="Selecionar imagens" />
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <label htmlFor="notif-target" className="block text-xs font-medium text-gray-600 mb-1">
                  {isSupervisor ? "Sua equipe" : "Destinatário"}
                </label>
                {canSendToAll ? (
                  <select id="notif-target" value={targetTeam} onChange={(e) => setTargetTeam(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white" title="Selecione a equipe destinatária">
                    <option value="todos">Todos</option>
                    {teamOptions.map(team => (<option key={team} value={team}>{team}</option>))}
                  </select>
                ) : (
                  <input type="text" value={currentUser?.equipe || "Sua equipe"} disabled
                    className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-100 cursor-not-allowed" title="Sua equipe" placeholder="Sua equipe" />
                )}
              </div>
              <button onClick={handleSend} disabled={sending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#09175b] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50" title="Enviar notificação">
                <Send className="w-4 h-4" /> {sending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== INSIGHT CARDS ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {insightCards.map((card, i) => {
          const Icon = iconMap[card.icon] || Zap;
          return (
            <div key={card.title} className="madm-card p-5 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms`, borderLeft: `4px solid ${card.color}` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: card.bg }}><Icon className="w-4.5 h-4.5" style={{ color: card.color }} /></div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${card.urgencyColor}15`, color: card.urgencyColor }}>{card.urgency}</span>
              </div>
              <h4 className="text-sm font-bold text-gray-800 mb-1.5">{card.title}</h4>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">{card.description}</p>
              <button onClick={() => handleInsightAction(card.action, card.title)}
                className="flex items-center gap-1 text-xs font-semibold hover:gap-2 transition-all" style={{ color: card.color }}>
                {card.action} <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* ========== LISTA DE NOTIFICAÇÕES ========== */}
      <div className="madm-card animate-fade-in-up" style={{ animationDelay: "320ms" }}>
        <div className="p-5 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Bell className="w-4 h-4 text-[#09175b]" />
            <h3 className="text-sm font-bold text-[#09175b]">Central de Notificações</h3>
            {unreadCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#ef4444", color: "white" }}>
                {unreadCount} não lida{unreadCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {[
                { value: "todos", label: "Todas" },
                { value: "nao_lidas", label: "Não lidas" },
                ...Object.keys(typeConfig).map(key => ({ value: key, label: typeConfig[key].label })),
              ].map((f) => (
                <button key={f.value} onClick={() => setFilter(f.value)}
                  className={cn("px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                    filter === f.value ? "bg-white text-[#09175b] shadow-sm" : "text-gray-500 hover:text-gray-700")}
                  title={`Filtrar: ${f.label}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#09175b] hover:opacity-80 transition-opacity px-3 py-1.5 rounded-lg border border-[#09175b]/20"
                title="Marcar todas como lidas">
                <BellOff className="w-3.5 h-3.5" /> Marcar todas como lidas
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {filtered.map((notif) => {
            const config = typeConfig[notif.type] || typeConfig.info;
            const Icon = config.icon;
            const isEditing = editingId === notif.id;

            if (isEditing && canManage) {
              return (
                <div key={notif.id} className="px-5 py-4 bg-white">
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input value={editForm.title} onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200" placeholder="Título" title="Editar título" />
                      <select value={editForm.type} onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value as any }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white" title="Editar tipo">
                        <option value="info">Informativo</option>
                        <option value="orientacao">Orientação</option>
                        <option value="success">Sucesso</option>
                        <option value="warning">Aviso</option>
                        <option value="danger">Urgente</option>
                      </select>
                    </div>
                    <textarea value={editForm.message} onChange={(e) => setEditForm(prev => ({ ...prev, message: e.target.value }))} rows={3}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200" placeholder="Mensagem" title="Editar mensagem" />
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Imagens</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {editForm.images.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img src={img} alt={`Anexo ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border cursor-pointer" onClick={() => setExpandedImage(img)} />
                            <button onClick={() => removeEditImage(idx)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remover imagem"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="w-16 h-16 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-[#09175b] transition-colors"
                          title="Adicionar imagem"><ImagePlus className="w-5 h-5 text-gray-400" /></button>
                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleEditImageUpload} className="hidden" title="Selecionar imagens" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#09175b] text-white rounded-lg hover:opacity-90" title="Salvar edição">
                        <Save className="w-3.5 h-3.5" /> Salvar
                      </button>
                      <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50" title="Cancelar">
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={notif.id}
                className={cn("flex gap-4 px-5 py-4 transition-all cursor-pointer",
                  !notif.read ? "bg-blue-50/30 hover:bg-blue-50/50" : "hover:bg-gray-50/50")}
                onClick={() => handleMarkRead(notif.id)}
                title="Clique para marcar como lida"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: config.bg, border: `1px solid ${config.border}` }}>
                  <Icon className="w-4 h-4" style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{notif.title}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: config.bg, color: config.color }}>{config.label}</span>
                      {!notif.read && <div className="w-2 h-2 rounded-full bg-[#09175b] flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                        <Clock className="w-3 h-3" /> {notif.time}
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); startEdit(notif); }}
                            className="p-1 rounded hover:bg-gray-200 transition-colors" title="Editar notificação">
                            <Pencil className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                            className="p-1 rounded hover:bg-red-100 transition-colors" title="Excluir notificação">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-2">{notif.message}</p>
                  {notif.images && notif.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {notif.images.map((img: string, idx: number) => (
                        <div key={idx} className="relative group">
                          <img
                            src={img}
                            alt={`Anexo ${idx + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setExpandedImage(img); }}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedImage(img); }}
                            className="absolute bottom-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Expandir imagem"
                          >
                            <Maximize2 className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={(e) => handleNotificationAction(notif.action, notif.title, e)}
                    className="flex items-center gap-1 text-xs font-semibold hover:gap-2 transition-all"
                    style={{ color: config.color }} title={notif.action}>
                    {notif.action} <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <BellOff className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">Nenhuma notificação encontrada</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            {filtered.length} notificação{filtered.length !== 1 ? "ões" : ""} • Clique para marcar como lida
          </p>
        </div>
      </div>

      {/* ========== MODAL DE IMAGEM EXPANDIDA ========== */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              title="Fechar"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={expandedImage}
              alt="Imagem expandida"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}