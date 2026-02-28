"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getTagStore } from "@/lib/tagStore";
import {
  listPipelines,
  createLead as apiCreateLead,
  updateLead as apiUpdateLead,
  deleteLead as apiDeleteLead,
  moveLead as apiMoveLead,
  type CRMPipeline,
  type CRMLead,
} from "@/lib/api";
import {
  listNotes,
  createNote,
  deleteNote,
  updateConversationTags,
  type NoteItem,
} from "@/lib/api";
import { toast } from "sonner";
import {
  Tag,
  StickyNote,
  BarChart3,
  CalendarClock,
  Check,
  Plus,
  X,
  Send as SendIcon,
  ChevronRight,
  DollarSign,
  Mail,
  Building2,
  Percent,
  Type,
  Mic,
  Image,
  Upload,
  Loader2,
} from "lucide-react";

type ScheduleContentType = "texto" | "audio" | "imagem";

interface ClientDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  contact: {
    name: string;
    phone: string;
    avatar: string;
    photo?: string | null;
    contact_id?: string | null;
  } | null;
  tags: string[]; // active tag names
  allTagIds: string[]; // active tag ids for persistence
  onToggleTag: (tagId: string, tagName: string) => void;
  onCrmUpdate?: () => void;
}

export function ClientDetailPanel({
  open,
  onOpenChange,
  conversationId,
  contact,
  tags,
  allTagIds,
  onToggleTag,
  onCrmUpdate,
}: ClientDetailPanelProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [scheduledMessages, setScheduledMessages] = useState<
    { id: string; text: string; date: string }[]
  >([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    text: "",
    date: "",
    time: "",
  });
  const [scheduleContentTypes, setScheduleContentTypes] = useState<
    ScheduleContentType[]
  >(["texto"]);
  const [scheduleAudioFile, setScheduleAudioFile] = useState<string | null>(
    null,
  );
  const [scheduleImageFile, setScheduleImageFile] = useState<string | null>(
    null,
  );

  // CRM form state
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [showCrmForm, setShowCrmForm] = useState(false);
  const [crmForm, setCrmForm] = useState({
    value: "",
    email: "",
    company: "",
    probability: "",
    tag: "",
  });
  const [stages, setStages] = useState<{ id: string; title: string; color: string | null }[]>([]);
  const [existingLeadId, setExistingLeadId] = useState<string | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);

  // Color palette for pipeline stages
  const stageColorPalette = [
    { bar: "bg-blue-500", bg: "bg-blue-500/8", text: "text-blue-600" },
    { bar: "bg-cyan-500", bg: "bg-cyan-500/8", text: "text-cyan-600" },
    { bar: "bg-amber-500", bg: "bg-amber-500/8", text: "text-amber-600" },
    { bar: "bg-purple-500", bg: "bg-purple-500/8", text: "text-purple-600" },
    { bar: "bg-emerald-500", bg: "bg-emerald-500/8", text: "text-emerald-600" },
    { bar: "bg-rose-500", bg: "bg-rose-500/8", text: "text-rose-600" },
    { bar: "bg-indigo-500", bg: "bg-indigo-500/8", text: "text-indigo-600" },
    { bar: "bg-orange-500", bg: "bg-orange-500/8", text: "text-orange-600" },
  ];
  const getStageColors = (index: number) => stageColorPalette[index % stageColorPalette.length];

  // Fetch notes from API
  const fetchNotes = useCallback(async () => {
    if (!conversationId) return;
    setNotesLoading(true);
    try {
      const data = await listNotes(conversationId);
      setNotes(data);
    } catch {
      // silently fail
    } finally {
      setNotesLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (open && contact) {
      fetchNotes();
      setCrmLoading(true);
      listPipelines()
        .then((pipelines) => {
          const sortedPipelines = [...pipelines].sort((a, b) => a.position - b.position);
          setStages(sortedPipelines.map((p) => ({ id: p.id, title: p.title, color: p.color })));

          // Find existing lead by contact_id or contact name
          let foundLead: CRMLead | null = null;
          let foundPipelineId: string | null = null;
          for (const pipeline of sortedPipelines) {
            for (const lead of pipeline.leads) {
              if (
                (contact.contact_id && lead.contact_id === contact.contact_id) ||
                lead.name === contact.name
              ) {
                foundLead = lead;
                foundPipelineId = pipeline.id;
                break;
              }
            }
            if (foundLead) break;
          }

          if (foundLead && foundPipelineId) {
            setExistingLeadId(foundLead.id);
            setSelectedStage(foundPipelineId);
            setCrmForm({
              value: foundLead.value?.toString() || "",
              email: foundLead.email || "",
              company: foundLead.company || "",
              probability: foundLead.probability?.toString() || "",
              tag: foundLead.tag || "",
            });
          } else {
            setExistingLeadId(null);
            setSelectedStage(null);
            setCrmForm({ value: "", email: "", company: "", probability: "", tag: "" });
          }
        })
        .catch(() => {
          toast.error("Erro ao carregar pipelines");
        })
        .finally(() => setCrmLoading(false));
      setShowCrmForm(false);
    }
  }, [open, contact]);

  const addNote = async () => {
    if (!newNote.trim() || !conversationId) return;
    const text = newNote.trim();
    setNewNote("");
    try {
      const created = await createNote(conversationId, text);
      setNotes((prev) => [created, ...prev]);
    } catch {
      toast.error("Erro ao salvar anotação");
      setNewNote(text);
    }
  };

  const removeNote = async (id: string) => {
    if (!conversationId) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNote(conversationId, id);
    } catch {
      toast.error("Erro ao remover anotação");
      fetchNotes();
    }
  };

  const handleStageClick = (stageId: string) => {
    setSelectedStage(stageId);
    setShowCrmForm(true);
  };

  const handleSaveToPipeline = async () => {
    if (!selectedStage || !contact) return;
    setCrmLoading(true);
    try {
      const leadData = {
        name: contact.name,
        phone: contact.phone,
        value: parseFloat(crmForm.value) || 0,
        email: crmForm.email || undefined,
        company: crmForm.company || undefined,
        probability: parseInt(crmForm.probability) || 0,
        tag: crmForm.tag || undefined,
      };

      if (existingLeadId) {
        // Move to new stage if changed, then update fields
        await apiMoveLead(existingLeadId, { pipeline_id: selectedStage, position: 0 });
        await apiUpdateLead(existingLeadId, leadData);
      } else {
        // Create new lead
        const created = await apiCreateLead({
          pipeline_id: selectedStage,
          ...leadData,
          contact_id: contact.contact_id || undefined,
        });
        setExistingLeadId(created.id);
      }
      setShowCrmForm(false);
      toast.success("Lead salvo no pipeline");
      onCrmUpdate?.();
    } catch {
      toast.error("Erro ao salvar lead");
    } finally {
      setCrmLoading(false);
    }
  };

  const handleRemoveFromPipeline = async () => {
    if (!existingLeadId) return;
    setCrmLoading(true);
    try {
      await apiDeleteLead(existingLeadId);
      setExistingLeadId(null);
      setSelectedStage(null);
      setShowCrmForm(false);
      setCrmForm({ value: "", email: "", company: "", probability: "", tag: "" });
      toast.success("Lead removido do pipeline");
      onCrmUpdate?.();
    } catch {
      toast.error("Erro ao remover lead");
    } finally {
      setCrmLoading(false);
    }
  };

  const toggleScheduleContentType = (type: ScheduleContentType) => {
    setScheduleContentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  if (!contact) return null;

  const currentStageName = selectedStage
    ? stages.find((s) => s.id === selectedStage)?.title
    : null;

  const scheduleContentOptions: {
    value: ScheduleContentType;
    label: string;
    icon: typeof Type;
  }[] = [
    { value: "texto", label: "Texto", icon: Type },
    { value: "audio", label: "Áudio", icon: Mic },
    { value: "imagem", label: "Imagem", icon: Image },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            {contact.photo ? (
              <img
                src={contact.photo}
                alt={contact.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full gradient-green flex items-center justify-center text-sm font-bold text-primary-foreground">
                {contact.avatar}
              </div>
            )}
            <div>
              <SheetTitle className="text-base">{contact.name}</SheetTitle>
              <SheetDescription className="text-xs">
                {contact.phone}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-6">
            {/* === TAGS === */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Etiquetas
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {getTagStore().map((tagItem) => {
                  const isActive = tags.includes(tagItem.name);
                  return (
                    <button
                      key={tagItem.name}
                      onClick={() => onToggleTag(tagItem.id, tagItem.name)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                        isActive
                          ? "text-white border-transparent"
                          : "text-foreground border-border hover:border-muted-foreground/30",
                      )}
                      style={isActive ? { backgroundColor: tagItem.color } : {}}
                    >
                      {isActive && <Check className="w-3 h-3" />}
                      {tagItem.name}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* === CRM CLASSIFICATION === */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Classificação CRM
                  </h3>
                </div>
                {currentStageName && existingLeadId && (
                  <button
                    onClick={handleRemoveFromPipeline}
                    disabled={crmLoading}
                    className="text-[11px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    Remover
                  </button>
                )}
              </div>

              {currentStageName && !showCrmForm && (
                <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Estágio atual
                      </p>
                      <p className="text-sm font-semibold text-primary">
                        {currentStageName}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCrmForm(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                  {crmForm.value && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Valor: R${" "}
                      {parseFloat(crmForm.value).toLocaleString("pt-BR")}
                      {crmForm.probability &&
                        ` • ${crmForm.probability}% prob.`}
                    </p>
                  )}
                </div>
              )}

              {crmLoading && stages.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-1">
                  {stages.map((stage, idx) => {
                    const colors = getStageColors(idx);
                    const isSelected = selectedStage === stage.id;
                    return (
                      <button
                        key={stage.id}
                        onClick={() => handleStageClick(stage.id)}
                        disabled={crmLoading}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all text-left group",
                          isSelected
                            ? `${colors.bg} font-medium ring-1 ring-primary/20`
                            : "text-foreground hover:bg-muted",
                          crmLoading && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "w-2.5 h-2.5 rounded-full",
                              isSelected
                                ? colors.bar
                                : "bg-muted-foreground/20",
                            )}
                          />
                          <span
                            className={isSelected ? colors.text : ""}
                          >
                            {stage.title}
                          </span>
                        </div>
                        <ChevronRight
                          className={cn(
                            "w-3.5 h-3.5 transition-opacity",
                            isSelected
                              ? "opacity-60"
                              : "opacity-0 group-hover:opacity-40",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {showCrmForm && selectedStage && (
                <div className="mt-3 p-4 rounded-lg border border-border bg-card space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Dados do Lead —{" "}
                    {stages.find((s) => s.id === selectedStage)?.title}
                  </p>
                  <div className="space-y-2.5">
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="number"
                        placeholder="Valor do orçamento"
                        value={crmForm.value}
                        onChange={(e) =>
                          setCrmForm({ ...crmForm, value: e.target.value })
                        }
                        className="w-full bg-muted rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="email"
                        placeholder="E-mail"
                        value={crmForm.email}
                        onChange={(e) =>
                          setCrmForm({ ...crmForm, email: e.target.value })
                        }
                        className="w-full bg-muted rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="text"
                        placeholder="Empresa"
                        value={crmForm.company}
                        onChange={(e) =>
                          setCrmForm({ ...crmForm, company: e.target.value })
                        }
                        className="w-full bg-muted rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Probabilidade (%)"
                        value={crmForm.probability}
                        onChange={(e) =>
                          setCrmForm({
                            ...crmForm,
                            probability: e.target.value,
                          })
                        }
                        className="w-full bg-muted rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Etiqueta do lead (ex: Quente, VIP)"
                      value={crmForm.tag}
                      onChange={(e) =>
                        setCrmForm({ ...crmForm, tag: e.target.value })
                      }
                      className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setShowCrmForm(false)}
                      className="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveToPipeline}
                      disabled={crmLoading}
                      className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {crmLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        "Salvar no Pipeline"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* === NOTES === */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Anotações
                </h3>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                  placeholder="Nova anotação..."
                  className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button
                  onClick={addNote}
                  className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {notesLoading && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Carregando...
                  </p>
                )}
                {!notesLoading &&
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-muted/50 rounded-lg px-3 py-2.5 group relative"
                    >
                      <p className="text-sm text-foreground pr-6">
                        {note.text}
                      </p>
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        {note.user_name ? `${note.user_name} • ` : ""}
                        {new Date(note.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      <button
                        onClick={() => removeNote(note.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
                      >
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                {!notesLoading && notes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhuma anotação
                  </p>
                )}
              </div>
            </section>

            {/* === SCHEDULED MESSAGES === */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Disparos Programados
                </h3>
              </div>
              <div className="space-y-2">
                {scheduledMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-muted/50 rounded-lg px-3 py-2.5 flex items-start gap-3"
                  >
                    <SendIcon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{msg.text}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {msg.date}
                      </span>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setShowScheduleForm(!showScheduleForm);
                    setScheduleContentTypes(["texto"]);
                    setScheduleAudioFile(null);
                    setScheduleImageFile(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agendar mensagem
                </button>

                {showScheduleForm && (
                  <div className="mt-2 p-3 rounded-lg border border-border bg-card space-y-3 animate-in slide-in-from-top-2 duration-200">
                    {/* Content type toggles */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Tipo de conteúdo
                      </p>
                      <div className="flex gap-1.5">
                        {scheduleContentOptions.map((opt) => {
                          const isActive = scheduleContentTypes.includes(
                            opt.value,
                          );
                          return (
                            <button
                              key={opt.value}
                              onClick={() =>
                                toggleScheduleContentType(opt.value)
                              }
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                isActive
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border text-muted-foreground hover:bg-muted",
                              )}
                            >
                              <opt.icon className="w-3.5 h-3.5" />
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Text input */}
                    {scheduleContentTypes.includes("texto") && (
                      <input
                        value={scheduleForm.text}
                        onChange={(e) =>
                          setScheduleForm({
                            ...scheduleForm,
                            text: e.target.value,
                          })
                        }
                        placeholder="Mensagem..."
                        className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    )}

                    {/* Audio upload */}
                    {scheduleContentTypes.includes("audio") && (
                      <div>
                        {scheduleAudioFile ? (
                          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                            <Mic className="w-4 h-4 text-primary" />
                            <span className="text-xs text-foreground flex-1">
                              {scheduleAudioFile}
                            </span>
                            <button
                              onClick={() => setScheduleAudioFile(null)}
                              className="text-xs text-destructive"
                            >
                              Remover
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setScheduleAudioFile("audio-agendado.mp3")
                            }
                            className="w-full flex items-center gap-2 py-3 border border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all justify-center"
                          >
                            <Upload className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              Enviar áudio
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Image upload */}
                    {scheduleContentTypes.includes("imagem") && (
                      <div>
                        {scheduleImageFile ? (
                          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                            <Image className="w-4 h-4 text-primary" />
                            <span className="text-xs text-foreground flex-1">
                              {scheduleImageFile}
                            </span>
                            <button
                              onClick={() => setScheduleImageFile(null)}
                              className="text-xs text-destructive"
                            >
                              Remover
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setScheduleImageFile("imagem-agendada.jpg")
                            }
                            className="w-full flex items-center gap-2 py-3 border border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all justify-center"
                          >
                            <Upload className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              Enviar imagem
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={scheduleForm.date}
                        onChange={(e) =>
                          setScheduleForm({
                            ...scheduleForm,
                            date: e.target.value,
                          })
                        }
                        className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <input
                        type="time"
                        value={scheduleForm.time}
                        onChange={(e) =>
                          setScheduleForm({
                            ...scheduleForm,
                            time: e.target.value,
                          })
                        }
                        className="w-28 bg-muted rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowScheduleForm(false)}
                        className="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (
                            !scheduleForm.text.trim() &&
                            scheduleContentTypes.includes("texto")
                          )
                            return;
                          const dateStr = scheduleForm.date
                            ? new Date(
                                scheduleForm.date +
                                  "T" +
                                  (scheduleForm.time || "12:00"),
                              ).toLocaleDateString("pt-BR") +
                              " " +
                              (scheduleForm.time || "12:00")
                            : new Date().toLocaleDateString("pt-BR") + " 12:00";
                          const types = scheduleContentTypes.join(" + ");
                          setScheduledMessages((prev) => [
                            ...prev,
                            {
                              id: Date.now().toString(),
                              text: `[${types}] ${scheduleForm.text || "Mídia agendada"}`,
                              date: dateStr,
                            },
                          ]);
                          setScheduleForm({ text: "", date: "", time: "" });
                          setScheduleContentTypes(["texto"]);
                          setScheduleAudioFile(null);
                          setScheduleImageFile(null);
                          setShowScheduleForm(false);
                        }}
                        className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        Agendar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
