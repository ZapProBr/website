"use client";

import { AppLayout } from "@/components/AppLayout";
import { useState, useRef, useCallback, DragEvent } from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { Pipeline, Lead } from "@/components/crm/types";
import { getPipelineStore, setPipelineStore } from "@/lib/crmStore";
import { PipelineColumn } from "@/components/crm/PipelineColumn";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function CRMPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>(getPipelineStore());
  const [draggedLead, setDraggedLead] = useState<{ lead: Lead; fromColumnId: string } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const dragCounter = useRef<Record<string, number>>({});

  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadTargetStage, setLeadTargetStage] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", value: "", company: "", email: "", probability: "", tag: "" });

  const [showStageModal, setShowStageModal] = useState(false);
  const [stageName, setStageName] = useState("");

  // Advanced filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterEmail, setFilterEmail] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterValueMin, setFilterValueMin] = useState("");
  const [filterValueMax, setFilterValueMax] = useState("");

  const updatePipelines = useCallback((updater: (prev: Pipeline[]) => Pipeline[]) => {
    setPipelines((prev) => {
      const next = updater(prev);
      setPipelineStore(next);
      return next;
    });
  }, []);

  const refreshFromStore = useCallback(() => {
    setPipelines([...getPipelineStore()]);
  }, []);

  const filteredPipelines = pipelines.map((p) => ({
    ...p,
    leads: p.leads.filter((lead) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || 
        lead.name.toLowerCase().includes(q) ||
        lead.company?.toLowerCase().includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.phone?.toLowerCase().includes(q) ||
        lead.tag?.toLowerCase().includes(q) ||
        lead.value?.toString().includes(q);
      
      const matchEmail = !filterEmail || lead.email?.toLowerCase().includes(filterEmail.toLowerCase());
      const matchPhone = !filterPhone || lead.phone?.includes(filterPhone);
      const matchValueMin = !filterValueMin || (lead.value || 0) >= parseFloat(filterValueMin);
      const matchValueMax = !filterValueMax || (lead.value || 0) <= parseFloat(filterValueMax);

      return matchSearch && matchEmail && matchPhone && matchValueMin && matchValueMax;
    }),
  }));

  // --- Drag & drop handlers (leads) ---
  const handleDragStart = (e: DragEvent, lead: Lead, columnId: string) => {
    setDraggedLead({ lead, fromColumnId: columnId });
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.4";
  };
  const handleDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
    setDraggedLead(null);
    setDragOverColumn(null);
    dragCounter.current = {};
  };
  const handleDragEnter = (e: DragEvent, columnId: string) => {
    e.preventDefault();
    dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) + 1;
    setDragOverColumn(columnId);
  };
  const handleDragLeave = (e: DragEvent, columnId: string) => {
    e.preventDefault();
    dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) - 1;
    if (dragCounter.current[columnId] <= 0) {
      dragCounter.current[columnId] = 0;
      if (dragOverColumn === columnId) setDragOverColumn(null);
    }
  };
  const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDrop = (e: DragEvent, toColumnId: string) => {
    e.preventDefault();
    if (!draggedLead || draggedLead.fromColumnId === toColumnId) return;
    updatePipelines((prev) =>
      prev.map((p) => {
        if (p.id === draggedLead.fromColumnId) return { ...p, leads: p.leads.filter((l) => l.id !== draggedLead.lead.id) };
        if (p.id === toColumnId) return { ...p, leads: [...p.leads, draggedLead.lead] };
        return p;
      })
    );
    setDraggedLead(null);
    setDragOverColumn(null);
    dragCounter.current = {};
  };

  // --- Drag & drop handlers (columns) ---
  const handleColumnDragStart = (e: DragEvent, columnId: string) => {
    setDraggedColumnId(columnId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", columnId);
  };
  const handleColumnDragOver = (e: DragEvent, columnId: string) => {
    e.preventDefault();
    if (!draggedColumnId || draggedColumnId === columnId) return;
    setDragOverColumnId(columnId);
  };
  const handleColumnDrop = (e: DragEvent, targetColumnId: string) => {
    e.preventDefault();
    if (!draggedColumnId || draggedColumnId === targetColumnId) return;
    updatePipelines((prev) => {
      const fromIndex = prev.findIndex((p) => p.id === draggedColumnId);
      const toIndex = prev.findIndex((p) => p.id === targetColumnId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setDraggedColumnId(null);
    setDragOverColumnId(null);
  };
  const handleColumnDragEnd = () => { setDraggedColumnId(null); setDragOverColumnId(null); };

  const openNewLeadModal = (stageId?: string) => {
    setLeadForm({ name: "", phone: "", value: "", company: "", email: "", probability: "", tag: "" });
    setLeadTargetStage(stageId || pipelines[0]?.id || null);
    setShowLeadModal(true);
  };

  const handleCreateLead = () => {
    if (!leadForm.name.trim() || !leadTargetStage) return;
    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      name: leadForm.name,
      phone: leadForm.phone || "(00) 00000-0000",
      value: parseFloat(leadForm.value) || 0,
      company: leadForm.company || undefined,
      email: leadForm.email || undefined,
      probability: parseInt(leadForm.probability) || 0,
      tag: leadForm.tag || undefined,
      lastContact: "Agora",
    };
    updatePipelines((prev) =>
      prev.map((p) => (p.id === leadTargetStage ? { ...p, leads: [...p.leads, newLead] } : p))
    );
    setShowLeadModal(false);
    toast.success(`Lead "${newLead.name}" adicionado`);
  };

  const handleAddStage = () => {
    if (!stageName.trim()) return;
    const newStage: Pipeline = { id: `stage-${Date.now()}`, title: stageName, leads: [] };
    updatePipelines((prev) => [...prev, newStage]);
    setShowStageModal(false);
    setStageName("");
    toast.success(`Estágio "${newStage.title}" criado`);
  };

  const handleRenameColumn = (columnId: string) => {
    const name = prompt("Novo nome do estágio:");
    if (!name?.trim()) return;
    updatePipelines((prev) => prev.map((p) => (p.id === columnId ? { ...p, title: name } : p)));
    toast.success("Estágio renomeado");
  };

  const handleClearColumn = (columnId: string) => {
    updatePipelines((prev) => prev.map((p) => (p.id === columnId ? { ...p, leads: [] } : p)));
    toast.success("Leads removidos do estágio");
  };

  const handleDeleteColumn = (columnId: string) => {
    updatePipelines((prev) => prev.filter((p) => p.id !== columnId));
    toast.success("Estágio removido");
  };

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Pipeline de Vendas</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie e acompanhe suas oportunidades</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Buscar por nome, valor, email, telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[300px] pl-9 pr-4 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/50 text-sm transition-colors",
                showFilters ? "bg-primary/10 text-primary border-primary/30" : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros
            </button>
            <button
              onClick={() => openNewLeadModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Novo Lead
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 flex-shrink-0">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">E-mail</label>
              <input value={filterEmail} onChange={(e) => setFilterEmail(e.target.value)} placeholder="Filtrar por email" className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 mt-1" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Telefone</label>
              <input value={filterPhone} onChange={(e) => setFilterPhone(e.target.value)} placeholder="Filtrar por telefone" className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 mt-1" />
            </div>
            <div className="w-32">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Valor mín.</label>
              <input type="number" value={filterValueMin} onChange={(e) => setFilterValueMin(e.target.value)} placeholder="0" className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 mt-1" />
            </div>
            <div className="w-32">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Valor máx.</label>
              <input type="number" value={filterValueMax} onChange={(e) => setFilterValueMax(e.target.value)} placeholder="∞" className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 mt-1" />
            </div>
            <button onClick={() => { setFilterEmail(""); setFilterPhone(""); setFilterValueMin(""); setFilterValueMax(""); }} className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors">Limpar</button>
          </div>
        )}

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto flex-1 pb-2 min-h-0">
          {filteredPipelines.map((pipeline) => (
            <PipelineColumn
              key={pipeline.id}
              pipeline={pipeline}
              dragOverColumn={dragOverColumn}
              draggedFromColumn={draggedLead?.fromColumnId || null}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDraggingColumn={draggedColumnId === pipeline.id}
              isColumnDropTarget={dragOverColumnId === pipeline.id && draggedColumnId !== pipeline.id}
              onColumnDragStart={handleColumnDragStart}
              onColumnDragOver={handleColumnDragOver}
              onColumnDrop={handleColumnDrop}
              onColumnDragEnd={handleColumnDragEnd}
              onAddLead={() => openNewLeadModal(pipeline.id)}
              onRenameColumn={() => handleRenameColumn(pipeline.id)}
              onClearColumn={() => handleClearColumn(pipeline.id)}
              onDeleteColumn={() => handleDeleteColumn(pipeline.id)}
            />
          ))}

          <button
            onClick={() => { setStageName(""); setShowStageModal(true); }}
            className="flex-shrink-0 w-[310px] rounded-xl border-2 border-dashed border-border/40 hover:border-primary/30 hover:bg-primary/5 flex items-center justify-center gap-2 text-sm text-muted-foreground/50 hover:text-primary/60 transition-all h-[120px] self-start"
          >
            <Plus className="w-4 h-4" />
            Adicionar Estágio
          </button>
        </div>
      </div>

      {/* New Lead Modal - wider layout */}
      <Dialog open={showLeadModal} onOpenChange={setShowLeadModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
            <DialogDescription>Preencha os dados para criar um novo lead.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome *</Label><Input value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} placeholder="Nome do lead" /></div>
            <div><Label>Telefone</Label><Input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="(00) 00000-0000" /></div>
            <div><Label>Valor (R$)</Label><Input type="number" value={leadForm.value} onChange={(e) => setLeadForm({ ...leadForm, value: e.target.value })} placeholder="0" /></div>
            <div><Label>Empresa</Label><Input value={leadForm.company} onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input type="email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} /></div>
            <div><Label>Probabilidade (%)</Label><Input type="number" min="0" max="100" value={leadForm.probability} onChange={(e) => setLeadForm({ ...leadForm, probability: e.target.value })} /></div>
            <div><Label>Etiqueta</Label><Input value={leadForm.tag} onChange={(e) => setLeadForm({ ...leadForm, tag: e.target.value })} placeholder="Ex: Quente, VIP" /></div>
            <div>
              <Label>Estágio</Label>
              <select
                value={leadTargetStage || ""}
                onChange={(e) => setLeadTargetStage(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {pipelines.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeadModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateLead} disabled={!leadForm.name.trim()}>Criar Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Stage Modal */}
      <Dialog open={showStageModal} onOpenChange={setShowStageModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Estágio</DialogTitle>
            <DialogDescription>Adicione um novo estágio ao pipeline.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Nome do estágio</Label>
            <Input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Ex: Follow-up" onKeyDown={(e) => e.key === "Enter" && handleAddStage()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageModal(false)}>Cancelar</Button>
            <Button onClick={handleAddStage} disabled={!stageName.trim()}>Criar Estágio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
