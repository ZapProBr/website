"use client";

import { AppLayout } from "@/components/AppLayout";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Upload, Download, Trash2, Pencil, Phone, Mail, Calendar, ChevronUp, ChevronDown, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  listTags as apiListTags,
  type Contact,
  type Tag,
} from "@/lib/api";

const avatarColors = [
  "bg-primary text-primary-foreground",
  "bg-chart-2 text-white",
  "bg-chart-4 text-white",
  "bg-destructive text-white",
  "bg-chart-3 text-white",
];

const getAvatarColor = (name: string) => {
  const idx = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[idx];
};

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

type SortField = "name" | "createdAt";
type SortDir = "asc" | "desc";

export default function ContatosPage() {
  const router = useRouter();
  const [contatos, setContatos] = useState<Contact[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showFilter, setShowFilter] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", tag_ids: [] as string[] });
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    try {
      const data = await listContacts({ search: searchQuery || undefined, tag_id: selectedTagId || undefined });
      setContatos(data);
    } catch { /* silently fail */ }
    setLoading(false);
  }, [searchQuery, selectedTagId]);

  const fetchTags = useCallback(async () => {
    try { setAllTags(await apiListTags()); } catch { /* silently fail */ }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);
  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const getTagColor = (tagName: string) => {
    const found = allTags.find((t) => t.name === tagName);
    return found?.color || "#22c55e";
  };

  const filtered = contatos
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return a.name.localeCompare(b.name) * dir;
      return a.created_at.localeCompare(b.created_at) * dir;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const toggleSelect = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((c) => c.id));

  const openNewModal = () => {
    setEditingId(null);
    setForm({ name: "", phone: "", email: "", tag_ids: [] });
    setShowModal(true);
  };

  const openEditModal = (c: Contact) => {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone, email: c.email || "", tag_ids: c.tags.map((t) => t.id) });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editingId) {
        await updateContact(editingId, { name: form.name, phone: form.phone, email: form.email || undefined, tag_ids: form.tag_ids });
        toast.success("Contato atualizado");
      } else {
        await createContact({ name: form.name, phone: form.phone, email: form.email || undefined, tag_ids: form.tag_ids });
        toast.success("Contato adicionado");
      }
      fetchContacts();
      setShowModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleDelete = async () => {
    try {
      await bulkDeleteContacts(selectedIds);
      toast.success(`${selectedIds.length} contato(s) excluído(s)`);
      setSelectedIds([]);
      fetchContacts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleExport = () => {
    const header = "Nome,Telefone,Email,Tags,Data de Criação\n";
    const rows = filtered.map((c) => `"${c.name}","${c.phone}","${c.email || ""}","${c.tags.map((t) => t.name).join("; ")}","${new Date(c.created_at).toLocaleDateString("pt-BR")}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contatos.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Contatos exportados");
  };

  const startConversation = (c: Contact) => {
    router.push(`/conversas?contactName=${encodeURIComponent(c.name)}&contactPhone=${encodeURIComponent(c.phone)}`);
    toast.success(`Abrindo conversa com ${c.name}`);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
              <p className="text-muted-foreground text-sm">Gerencie sua base de contatos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/30 text-destructive font-medium text-sm hover:bg-destructive/5 transition-colors">
                <Trash2 className="w-4 h-4" />
                Excluir ({selectedIds.length})
              </button>
            )}
            <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors">
              <Download className="w-4 h-4" />
              Exportar
            </button>
            <button onClick={() => toast.info("Funcionalidade em breve")} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors">
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <button onClick={openNewModal} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Novo Contato
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilter(!showFilter)} className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", showFilter ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              <Filter className="w-4 h-4" />
              FILTRO
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input type="text" placeholder="Buscar por nome, email ou telefone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full max-w-md pl-11 pr-5 py-2.5 rounded-xl bg-muted/50 border-none text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-muted/80 transition-all" />
          </div>
          {showFilter && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-xs text-muted-foreground font-medium">Tags:</span>
              <button onClick={() => setSelectedTagId(null)} className={cn("text-xs px-3 py-1 rounded-full font-medium transition-colors", !selectedTagId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>Todas</button>
              {allTags.map((tag) => (
                <button key={tag.id} onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)} className={cn("text-xs px-3 py-1 rounded-full font-medium transition-colors border", selectedTagId === tag.id ? "border-transparent text-white" : "border-transparent hover:opacity-80")} style={{ backgroundColor: selectedTagId === tag.id ? tag.color : `${tag.color}20`, color: selectedTagId === tag.id ? "white" : tag.color }}>{tag.name}</button>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-12 px-4 py-3"><input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="w-4 h-4 rounded border-border accent-primary cursor-pointer" /></th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => toggleSort("name")}>Nome <SortIcon field="name" /></th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Telefone</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Tags</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => toggleSort("createdAt")}>Data de Criação <SortIcon field="createdAt" /></th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", selectedIds.includes(c.id) && "bg-primary/5")}>
                  <td className="w-12 px-4 py-3.5"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-border accent-primary cursor-pointer" /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold", getAvatarColor(c.name))}>{getInitials(c.name)}</div>
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="w-3.5 h-3.5" />{c.email || "—"}</div></td>
                  <td className="px-4 py-3.5"><div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5" />{c.phone}</div></td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1.5 flex-wrap">
                      {c.tags.map((tag) => (<span key={tag.id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>{tag.name}</span>))}
                      {c.tags.length === 0 && <span className="text-xs text-muted-foreground/40">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Calendar className="w-3.5 h-3.5" />{new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div></td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startConversation(c)} className="p-1.5 rounded-md hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary" title="Iniciar conversa">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditModal(c)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Nenhum contato encontrado.</div>}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">{filtered.length} contato{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}</span>
            {selectedIds.length > 0 && <span className="text-xs text-primary font-medium">{selectedIds.length} selecionado{selectedIds.length !== 1 ? "s" : ""}</span>}
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Contato" : "Novo Contato"}</DialogTitle>
            <DialogDescription>{editingId ? "Atualize os dados do contato." : "Preencha os dados para criar um novo contato."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+55 (00) 00000-0000" /></div>
            <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" /></div>
            <div>
              <Label>Tags</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {allTags.map((tag) => {
                  const selected = form.tag_ids.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, tag_ids: selected ? f.tag_ids.filter((id) => id !== tag.id) : [...f.tag_ids, tag.id] }))}
                      className={cn("text-xs px-3 py-1 rounded-full font-medium transition-colors border", selected ? "border-transparent text-white" : "border-transparent hover:opacity-80")}
                      style={{ backgroundColor: selected ? tag.color : `${tag.color}20`, color: selected ? "white" : tag.color }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>{editingId ? "Salvar" : "Criar Contato"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
