"use client";

import { AppLayout } from "@/components/AppLayout";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Smartphone, QrCode, CheckCircle2, XCircle, Tag, Plus, X, Crown, Users, Mail, Lock, Pencil, Trash2, CreditCard, Wifi, Settings, Check, Sun, Moon, Loader2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tagColors } from "@/lib/tagStore";
import { useTheme } from "@/hooks/use-theme";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  listTags as apiListTags,
  createTag as apiCreateTag,
  updateTag as apiUpdateTag,
  deleteTag as apiDeleteTag,
  listUsers as apiListUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
  getMe,
  listInstances,
  createInstance,
  getQrCode,
  getInstanceStatus,
  logoutInstance,
  deleteInstance,
  type Tag as TagType,
  type User as UserType,
  type EvolutionInstance,
} from "@/lib/api";

type TabKey = "assinatura" | "conexoes" | "etiquetas" | "usuarios" | "aparencia";

const tabs: { key: TabKey; label: string; icon: typeof CreditCard }[] = [
  { key: "assinatura", label: "Assinatura", icon: CreditCard },
  { key: "conexoes", label: "Conexões", icon: Wifi },
  { key: "etiquetas", label: "Etiquetas", icon: Tag },
  { key: "usuarios", label: "Usuários", icon: Users },
  { key: "aparencia", label: "Aparência", icon: Sun },
];

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

const plans = [
  {
    name: "Basic",
    price: "R$ 97",
    period: "/mês",
    features: ["2 conexões WhatsApp", "Disparos ilimitados", "CRM básico", "3 usuários", "Suporte por email"],
    current: true,
  },
  {
    name: "Pro",
    price: "R$ 197",
    period: "/mês",
    features: ["5 conexões WhatsApp", "Disparos ilimitados", "CRM avançado", "10 usuários", "Automações avançadas", "Suporte prioritário"],
    popular: true,
  },
  {
    name: "Premium",
    price: "R$ 397",
    period: "/mês",
    features: ["Conexões ilimitadas", "Disparos ilimitados", "CRM completo", "Usuários ilimitados", "Automações completas", "API integrada", "Suporte 24/7"],
  },
];

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("assinatura");
  const [tags, setTagsState] = useState<TagType[]>([]);
  const [newTag, setNewTag] = useState("");
  const [newColor, setNewColor] = useState(tagColors[0].value);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "atendente" });
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editTagColor, setEditTagColor] = useState("");
  const { theme, setTheme } = useTheme();
  const [currentPlan, setCurrentPlan] = useState("basic");
  const [myRole, setMyRole] = useState<"admin" | "atendente">("atendente");
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Evolution / Conexões state
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [showNewInstance, setShowNewInstance] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceNumber, setNewInstanceNumber] = useState("");
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrInstance, setQrInstance] = useState<string | null>(null); // instance name showing QR
  const [qrData, setQrData] = useState<string | null>(null); // base64 QR image
  const [qrPairingCode, setQrPairingCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pollingQr, setPollingQr] = useState(false);

  // Fetch current user plan
  useEffect(() => {
    getMe().then((u) => { setCurrentPlan(u.plan); setMyRole(u.role); }).catch(() => {});
  }, []);

  // Fetch instances
  const fetchInstances = useCallback(async () => {
    setLoadingInstances(true);
    try {
      const data = await listInstances();
      setInstances(data);
    } catch { /* silently fail */ }
    setLoadingInstances(false);
  }, []);

  // QR code polling – when qrInstance is set, fetch QR and poll status
  useEffect(() => {
    if (!qrInstance) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    const fetchQr = async () => {
      setQrLoading(true);
      try {
        const data = await getQrCode(qrInstance);
        if (cancelled) return;
        setQrData(data.base64);
        setQrPairingCode(data.pairingCode);
      } catch {
        if (!cancelled) toast.error("Erro ao gerar QR Code");
      }
      setQrLoading(false);
    };

    const pollStatus = async () => {
      try {
        const st = await getInstanceStatus(qrInstance);
        if (cancelled) return;
        if (st.status === "open") {
          // Connected!
          setQrInstance(null);
          setQrData(null);
          setPollingQr(false);
          toast.success("WhatsApp conectado com sucesso!");
          fetchInstances();
        }
      } catch { /* ignore */ }
    };

    fetchQr();
    setPollingQr(true);
    interval = setInterval(() => {
      pollStatus();
    }, 4000); // check every 4 seconds

    return () => {
      cancelled = true;
      clearInterval(interval);
      setPollingQr(false);
    };
  }, [qrInstance, fetchInstances]);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) return;
    setCreatingInstance(true);
    try {
      await createInstance({ instanceName: newInstanceName.trim(), number: newInstanceNumber.trim() || undefined });
      setShowNewInstance(false);
      setNewInstanceName("");
      setNewInstanceNumber("");
      toast.success("Instância criada! Agora conecte via QR Code.");
      await fetchInstances();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar instância");
    }
    setCreatingInstance(false);
  };

  const handleConnectQr = (name: string) => {
    setQrData(null);
    setQrPairingCode(null);
    setQrInstance(name);
  };

  const handleDisconnect = async (name: string) => {
    try {
      await logoutInstance(name);
      toast.success(`"${name}" desconectado`);
      fetchInstances();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao desconectar");
    }
  };

  const handleDeleteInstance = async (name: string) => {
    if (!confirm(`Excluir instância "${name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteInstance(name);
      // Remove from local state immediately
      setInstances((prev) => prev.filter((i) => i.instanceName !== name));
      toast.success(`"${name}" excluída`);
      await fetchInstances();
    } catch (err: unknown) {
      // If 404 it was already deleted — still remove from UI
      setInstances((prev) => prev.filter((i) => i.instanceName !== name));
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
  };

  // Fetch tags from API
  const fetchTags = useCallback(async () => {
    setLoadingTags(true);
    try {
      const data = await apiListTags();
      setTagsState(data);
    } catch { /* silently fail */ }
    setLoadingTags(false);
  }, []);

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await apiListUsers();
      setUsers(data.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role === "admin" ? "Administrador" : "Atendente",
        avatar: u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      })));
    } catch { /* silently fail */ }
    setLoadingUsers(false);
  }, []);

  useEffect(() => { fetchTags(); fetchUsers(); fetchInstances(); }, [fetchTags, fetchUsers, fetchInstances]);

  const addTag = async () => {
    if (!newTag.trim()) return;
    try {
      await apiCreateTag({ name: newTag.trim(), color: newColor });
      setNewTag(""); setNewColor(tagColors[0].value);
      fetchTags();
      toast.success("Etiqueta criada");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar etiqueta");
    }
  };
  const removeTag = async (id: string) => {
    try {
      await apiDeleteTag(id);
      fetchTags();
      toast.success("Etiqueta removida");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    }
  };
  const updateTagColor = async (id: string, color: string) => {
    try {
      await apiUpdateTag(id, { color });
      fetchTags();
      setEditingTag(null);
    } catch { /* silently fail */ }
  };

  const openNewUser = () => { setEditingUser(null); setUserForm({ name: "", email: "", password: "", role: "atendente" }); setShowUserModal(true); };
  const openEditUser = (user: UserItem) => { setEditingUser(user); setUserForm({ name: user.name, email: user.email, password: "", role: user.role === "Administrador" ? "admin" : "atendente" }); setShowUserModal(true); };
  const saveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) return;
    try {
      if (editingUser) {
        const payload: Record<string, string> = { name: userForm.name, email: userForm.email, role: userForm.role };
        if (userForm.password) payload.password = userForm.password;
        await apiUpdateUser(editingUser.id, payload);
        toast.success("Usuário atualizado");
      } else {
        await apiCreateUser({ name: userForm.name, email: userForm.email, password: userForm.password || "123456", role: userForm.role });
        toast.success("Usuário criado");
      }
      fetchUsers();
      setShowUserModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  const removeUser = async (id: string) => {
    try {
      await apiDeleteUser(id);
      fetchUsers();
      toast.success("Usuário removido");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Banner Upgrade */}
        <div className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center gap-3">
          <Crown className="w-4 h-4 text-primary-foreground" />
          <span className="text-sm font-semibold text-primary-foreground">Fazer upgrade de plano</span>
          <button onClick={() => setShowPlanModal(true)} className="ml-2 px-3 py-1 rounded-lg bg-primary-foreground/20 text-primary-foreground text-xs font-bold hover:bg-primary-foreground/30 transition-colors backdrop-blur-sm">
            Upgrade
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie sua conta, conexões, etiquetas e equipe</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
          {tabs.filter((tab) => tab.key !== "usuarios" || myRole === "admin").map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== ASSINATURA ===== */}
        {activeTab === "assinatura" && (
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Crown className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">Plano {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-primary/10 text-primary">Ativo</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {currentPlan === "basic" && "Até 2 conexões • Disparos ilimitados • CRM básico"}
                    {currentPlan === "pro" && "Até 5 conexões • CRM avançado • Automações"}
                    {currentPlan === "premium" && "Conexões ilimitadas • CRM completo • API"}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPlanModal(true)} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Upgrade</button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { label: "Conexões", value: currentPlan === "premium" ? "∞" : currentPlan === "pro" ? "5" : "2", desc: "números WhatsApp" },
                { label: "Usuários", value: `${users.length}`, desc: "ativos" },
                { label: "Disparos", value: "∞", desc: "ilimitados" },
              ].map((item) => (
                <div key={item.label} className="bg-muted/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== CONEXÕES ===== */}
        {activeTab === "conexoes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium bg-muted px-3 py-1 rounded-full">
                  {instances.length} {instances.length === 1 ? "instância" : "instâncias"}
                </span>
                <button onClick={fetchInstances} disabled={loadingInstances} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Atualizar">
                  <RefreshCw className={cn("w-4 h-4 text-muted-foreground", loadingInstances && "animate-spin")} />
                </button>
              </div>
              <button onClick={() => setShowNewInstance(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" /> Nova instância
              </button>
            </div>

            {loadingInstances && instances.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando instâncias...
              </div>
            )}

            {!loadingInstances && instances.length === 0 && (
              <div className="py-12 text-center">
                <Wifi className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma instância WhatsApp criada</p>
                <p className="text-xs text-muted-foreground mt-1">Clique em &quot;Nova instância&quot; para começar</p>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {instances.map((inst) => {
                const isConnected = inst.status === "open";
                const isConnecting = inst.status === "connecting";
                return (
                  <div key={inst.instanceName} className="rounded-2xl overflow-hidden bg-card border border-border">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-bold text-base">{inst.instanceName}</span>
                        {isConnected ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : isConnecting ? (
                          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive" />
                        )}
                      </div>
                    </div>

                    {/* Phone number */}
                    <div className="mx-5 mb-4 flex items-center justify-between rounded-lg px-3 py-2.5 bg-muted">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground tracking-wide">
                          {inst.number || "Não conectado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDeleteInstance(inst.instanceName)} className="p-1.5 rounded-md hover:bg-background transition-colors" title="Excluir instância">
                          <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                        </button>
                      </div>
                    </div>

                    {/* Profile info */}
                    <div className="flex items-center gap-3 px-5 pb-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground border border-border overflow-hidden">
                        {inst.profilePicUrl ? (
                          <img src={inst.profilePicUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          inst.instanceName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{inst.profileName || inst.instanceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {isConnected ? "WhatsApp conectado" : isConnecting ? "Conectando..." : "Desconectado"}
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 px-5 pb-3">
                      {isConnected ? (
                        <><CheckCircle2 className="w-4 h-4 text-primary" /><span className="text-sm font-semibold text-primary">Conexão estabelecida!</span></>
                      ) : isConnecting ? (
                        <><Loader2 className="w-4 h-4 text-amber-500 animate-spin" /><span className="text-sm font-semibold text-amber-500">Conectando...</span></>
                      ) : (
                        <><XCircle className="w-4 h-4 text-destructive" /><span className="text-sm font-semibold text-destructive">Desconectado</span></>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="px-5 pb-5 pt-1 flex justify-center">
                      {isConnected ? (
                        <button onClick={() => handleDisconnect(inst.instanceName)} className="px-6 py-2 rounded-md border border-border text-xs font-bold text-foreground uppercase tracking-widest hover:bg-muted transition-colors">
                          Desconectar
                        </button>
                      ) : (
                        <button onClick={() => handleConnectQr(inst.instanceName)} className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors flex items-center gap-2">
                          <QrCode className="w-3.5 h-3.5" /> Conectar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* QR Code Dialog */}
        <Dialog open={!!qrInstance} onOpenChange={(open) => { if (!open) { setQrInstance(null); setQrData(null); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                Conectar WhatsApp — {qrInstance}
              </DialogTitle>
              <DialogDescription>
                Abra o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar um aparelho → Escaneie o QR Code abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {qrLoading && !qrData ? (
                <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-xl">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : qrData ? (
                <img src={qrData} alt="QR Code" className="w-64 h-64 rounded-xl border border-border" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-xl text-sm text-muted-foreground">
                  Erro ao gerar QR Code
                </div>
              )}
              {qrPairingCode && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Ou use o código de pareamento:</p>
                  <p className="text-lg font-mono font-bold text-foreground tracking-widest">{qrPairingCode}</p>
                </div>
              )}
              {pollingQr && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Aguardando conexão...
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setQrInstance(null); setQrData(null); }}>Cancelar</Button>
              <Button onClick={() => { setQrData(null); setQrInstance(qrInstance); }}>
                <RefreshCw className="w-4 h-4 mr-1" /> Gerar novo QR
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Instance Dialog */}
        <Dialog open={showNewInstance} onOpenChange={setShowNewInstance}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova instância WhatsApp</DialogTitle>
              <DialogDescription>
                Crie uma nova instância para conectar um número WhatsApp.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nome da instância *</label>
                <input
                  type="text"
                  placeholder="Ex: Comercial, Suporte..."
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Número (opcional)</label>
                <input
                  type="text"
                  placeholder="5511999998888"
                  value={newInstanceNumber}
                  onChange={(e) => setNewInstanceNumber(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1">Formato: código do país + DDD + número</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewInstance(false)}>Cancelar</Button>
              <Button onClick={handleCreateInstance} disabled={creatingInstance || !newInstanceName.trim()}>
                {creatingInstance ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== ETIQUETAS (Professional list layout) ===== */}
        {activeTab === "etiquetas" && (
          <div className="glass-card rounded-xl p-5 space-y-4">
            {/* Add tag form */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <input type="text" placeholder="Nome da etiqueta..." value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()}
                  className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
                <button onClick={addTag} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Cor:</span>
                <div className="flex gap-1.5">
                  {tagColors.map((c) => (
                    <button key={c.value} onClick={() => setNewColor(c.value)} className={cn("w-7 h-7 rounded-full transition-all flex items-center justify-center", newColor === c.value ? "ring-2 ring-offset-2 ring-offset-card scale-110" : "hover:scale-110")} style={{ backgroundColor: c.value }} title={c.name}>
                      {newColor === c.value && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
                {newTag.trim() && (
                  <span className="inline-flex items-center text-xs font-medium px-3 py-1 rounded-full text-white ml-2" style={{ backgroundColor: newColor }}>{newTag.trim()}</span>
                )}
              </div>
            </div>

            {/* Tag list (professional layout) */}
            <div className="space-y-1">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium text-foreground flex-1">{tag.name}</span>

                  {editingTag === tag.id ? (
                    <div className="flex gap-1">
                      {tagColors.map(c => (
                        <button key={c.value} onClick={() => updateTagColor(tag.id, c.value)} className="w-5 h-5 rounded-full hover:scale-110 transition-all" style={{ backgroundColor: c.value }}>
                          {tag.color === c.value && <Check className="w-3 h-3 text-white mx-auto" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingTag(tag.id); setEditTagColor(tag.color); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar cor">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeTag(tag.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Remover">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {tags.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma etiqueta criada</p>}
            </div>
          </div>
        )}

        {/* ===== USUÁRIOS ===== */}
        {activeTab === "usuarios" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={openNewUser} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" /> Novo Usuário
              </button>
            </div>
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Usuário</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">E-mail</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Função</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full gradient-green flex items-center justify-center text-xs font-bold text-primary-foreground">{user.avatar}</div>
                          <span className="text-sm font-medium text-foreground">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{user.email}</td>
                      <td className="px-5 py-4">
                        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", user.role === "Administrador" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{user.role}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditUser(user)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => removeUser(user.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Remover"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== APARÊNCIA ===== */}
        {activeTab === "aparencia" && (
          <div className="glass-card rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">Tema</h3>
              <p className="text-sm text-muted-foreground mt-1">Escolha entre modo claro e escuro</p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
                  theme === "light"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                )}
              >
                <Sun className={cn("w-8 h-8", theme === "light" ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-semibold", theme === "light" ? "text-primary" : "text-muted-foreground")}>Claro</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
                  theme === "dark"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                )}
              >
                <Moon className={cn("w-8 h-8", theme === "dark" ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-semibold", theme === "dark" ? "text-primary" : "text-muted-foreground")}>Escuro</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Usuário */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{editingUser ? "Editar Usuário" : "Novo Usuário"}</h2>
              <button onClick={() => setShowUserModal(false)} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nome completo</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Nome do usuário" className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="email@empresa.com" className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{editingUser ? "Nova senha (deixe vazio para manter)" : "Senha"}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="••••••••" className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Função</label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all">
                  <option value="atendente">Atendente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowUserModal(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
              <button onClick={saveUser} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                {editingUser ? "Salvar Alterações" : "Criar Usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Upgrade Modal */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Escolha seu plano</DialogTitle>
            <DialogDescription>Selecione o plano ideal para o seu negócio.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.name.toLowerCase() === currentPlan;
              return (
                <div key={plan.name} className={cn("rounded-xl border p-5 space-y-4 relative transition-all", plan.popular ? "border-primary ring-2 ring-primary/20" : "border-border", isCurrent && "bg-primary/5")}>
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider">Popular</span>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    <div className="flex items-baseline gap-0.5 mt-1">
                      <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">{plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => {
                      if (isCurrent) return;
                      const userData = JSON.parse(localStorage.getItem("zapprobr_user") || "{}");
                      userData.plan = plan.name.toLowerCase();
                      localStorage.setItem("zapprobr_user", JSON.stringify(userData));
                      toast.success(`Plano alterado para ${plan.name}`);
                      setShowPlanModal(false);
                      window.location.reload();
                    }}
                    className={cn(
                      "w-full py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isCurrent
                        ? "bg-muted text-muted-foreground cursor-default"
                        : plan.popular
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border border-border text-foreground hover:bg-muted"
                    )}
                  >
                    {isCurrent ? "Plano atual" : "Selecionar"}
                  </button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
