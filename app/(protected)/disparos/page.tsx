"use client";

import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { Megaphone, Plus, Clock, CheckCircle2, AlertCircle, X, Type, Mic, Image, Users, Tag, Send, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getTagStore, getTagColor } from "@/lib/tagStore";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ContentType = "texto" | "audio" | "imagem";

const CONEXOES = [
  { id: "1", name: "Comercial 1", number: "(11) 99999-1234" },
  { id: "2", name: "Suporte", number: "(21) 98888-5678" },
];

interface Disparo {
  id: string;
  title: string;
  type: string;
  contacts: number;
  status: string;
  date: string;
  conexao?: string;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; label: string; class: string }> = {
  enviado: { icon: CheckCircle2, label: "Enviado", class: "text-primary bg-primary/10" },
  agendado: { icon: Clock, label: "Agendado", class: "text-chart-4 bg-chart-4/10" },
  rascunho: { icon: AlertCircle, label: "Rascunho", class: "text-muted-foreground bg-muted" },
};

export default function DisparosPage() {
  const [disparos, setDisparos] = useState<Disparo[]>([
    { id: "1", title: "Promoção Black Friday", type: "Texto + Imagem", contacts: 450, status: "enviado", date: "22/02/2026" },
    { id: "2", title: "Boas-vindas novos leads", type: "Texto", contacts: 120, status: "agendado", date: "24/02/2026" },
    { id: "3", title: "Reativação de clientes", type: "Áudio", contacts: 85, status: "rascunho", date: "-" },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [contentTypes, setContentTypes] = useState<ContentType[]>(["texto"]);
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"todos" | "tags">("todos");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedConexao, setSelectedConexao] = useState(CONEXOES[0].id);

  const toggleContentType = (type: ContentType) => {
    setContentTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const resetForm = () => {
    setTitle("");
    setContentTypes(["texto"]);
    setMessage("");
    setTargetType("todos");
    setSelectedTags([]);
    setSelectedConexao(CONEXOES[0].id);
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    const typeLabel = contentTypes.map(t => t === "texto" ? "Texto" : t === "audio" ? "Áudio" : "Imagem").join(" + ");
    const newDisparo: Disparo = {
      id: Date.now().toString(),
      title: title.trim(),
      type: typeLabel,
      contacts: targetType === "todos" ? 450 : selectedTags.length * 30,
      status: "rascunho",
      date: new Date().toLocaleDateString("pt-BR"),
      conexao: CONEXOES.find(c => c.id === selectedConexao)?.name,
    };
    setDisparos([newDisparo, ...disparos]);
    resetForm();
    setShowModal(false);
    toast.success(`Disparo "${newDisparo.title}" criado`);
  };

  const contentOptions: { value: ContentType; label: string; icon: typeof Type }[] = [
    { value: "texto", label: "Texto", icon: Type },
    { value: "audio", label: "Áudio", icon: Mic },
    { value: "imagem", label: "Imagem", icon: Image },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Disparos</h1>
            <p className="text-muted-foreground mt-1">Gerencie suas campanhas de disparo</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Disparo
          </button>
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Campanha</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Tipo</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Contatos</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {disparos.map((d) => {
                const st = statusConfig[d.status] || statusConfig.rascunho;
                const StIcon = st.icon;
                return (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Megaphone className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{d.title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{d.type}</td>
                    <td className="px-5 py-4 text-sm text-foreground font-medium">{d.contacts}</td>
                    <td className="px-5 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", st.class)}>
                        <StIcon className="w-3.5 h-3.5" />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{d.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Disparo Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Disparo</DialogTitle>
            <DialogDescription>Crie uma nova campanha de disparo de mensagens.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Conexão de envio</label>
              <div className="grid grid-cols-2 gap-2">
                {CONEXOES.map(c => (
                  <button key={c.id} onClick={() => setSelectedConexao(c.id)} className={cn("flex items-center gap-2 p-3 rounded-xl border transition-all text-left", selectedConexao === c.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/60")}>
                    <Smartphone className={cn("w-5 h-5", selectedConexao === c.id ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <span className={cn("text-sm font-medium block", selectedConexao === c.id ? "text-primary" : "text-foreground")}>{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.number}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Título da campanha</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Promoção de Natal" className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tipo de conteúdo (multi-seleção)</label>
              <div className="flex gap-2">
                {contentOptions.map(opt => {
                  const isActive = contentTypes.includes(opt.value);
                  return (
                    <button key={opt.value} onClick={() => toggleContentType(opt.value)} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all", isActive ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {contentTypes.includes("texto") && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Mensagem</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite a mensagem..." rows={3} className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none" />
              </div>
            )}

            {contentTypes.includes("audio") && (
              <button className="w-full flex items-center gap-2 py-4 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all justify-center">
                <Mic className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Enviar áudio (MP3, OGG, WAV)</span>
              </button>
            )}

            {contentTypes.includes("imagem") && (
              <button className="w-full flex items-center gap-2 py-4 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all justify-center">
                <Image className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Enviar imagem (JPG, PNG, WEBP)</span>
              </button>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Destinatários</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setTargetType("todos"); setSelectedTags([]); }} className={cn("flex items-center gap-2 p-3 rounded-xl border transition-all", targetType === "todos" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/60")}>
                  <Users className={cn("w-5 h-5", targetType === "todos" ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-sm font-medium", targetType === "todos" ? "text-primary" : "text-muted-foreground")}>Todos</span>
                </button>
                <button onClick={() => setTargetType("tags")} className={cn("flex items-center gap-2 p-3 rounded-xl border transition-all", targetType === "tags" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/60")}>
                  <Tag className={cn("w-5 h-5", targetType === "tags" ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-sm font-medium", targetType === "tags" ? "text-primary" : "text-muted-foreground")}>Por tags</span>
                </button>
              </div>
              {targetType === "tags" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {getTagStore().map(tagItem => (
                    <button key={tagItem.name} onClick={() => toggleTag(tagItem.name)} className={cn("text-xs font-medium px-3 py-1.5 rounded-full border transition-colors", selectedTags.includes(tagItem.name) ? "text-white border-transparent" : "bg-muted text-muted-foreground border-border hover:border-primary/20")} style={selectedTags.includes(tagItem.name) ? { backgroundColor: tagItem.color } : {}}>
                      {tagItem.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!title.trim()}>
              <Send className="w-4 h-4 mr-1.5" />
              Criar Disparo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
