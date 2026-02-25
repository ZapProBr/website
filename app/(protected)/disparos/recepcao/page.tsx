"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { MessageSquarePlus, Save, ToggleRight, Mic, Type, Upload, Plus, X, Megaphone, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CONEXOES = [
  { id: "1", name: "Comercial 1", number: "(11) 99999-1234" },
  { id: "2", name: "Suporte", number: "(21) 98888-5678" },
];

type ResponseType = "text" | "audio" | "both";

interface AdRule {
  id: string;
  keyword: string;
  responseType: ResponseType;
  message: string;
  audioFile: string | null;
}

export default function DisparoRecepcaoPage() {
  const [active, setActive] = useState(true);
  const [selectedConexao, setSelectedConexao] = useState(CONEXOES[0].id);
  const [responseType, setResponseType] = useState<ResponseType>("text");
  const [message, setMessage] = useState(
    "Olá! Obrigado por entrar em contato. Em breve um de nossos atendentes irá te responder. 😊"
  );
  const [audioFile, setAudioFile] = useState<string | null>(null);

  // Ad rules
  const [adRules, setAdRules] = useState<AdRule[]>([
    { id: "1", keyword: "promo", responseType: "text", message: "Obrigado pelo interesse na promoção! Um consultor entrará em contato.", audioFile: null },
  ]);
  const [showAdForm, setShowAdForm] = useState(false);
  const [adForm, setAdForm] = useState<{ keyword: string; responseType: ResponseType; message: string; audioFile: string | null }>({
    keyword: "", responseType: "text", message: "", audioFile: null,
  });

  const responseOptions: { value: ResponseType; label: string; icon: typeof Type }[] = [
    { value: "text", label: "Mensagem de Texto", icon: Type },
    { value: "audio", label: "Áudio", icon: Mic },
    { value: "both", label: "Texto + Áudio", icon: MessageSquarePlus },
  ];

  const addAdRule = () => {
    if (!adForm.keyword.trim()) return;
    setAdRules([...adRules, { ...adForm, id: Date.now().toString() }]);
    setAdForm({ keyword: "", responseType: "text", message: "", audioFile: null });
    setShowAdForm(false);
    toast.success("Regra de anúncio adicionada");
  };

  const removeAdRule = (id: string) => {
    setAdRules(adRules.filter(r => r.id !== id));
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Recepção Automática</h1>
            <p className="text-muted-foreground mt-1">Configure a resposta automática para novos atendimentos</p>
          </div>
        </div>

        {/* Ativar / Desativar */}
        <div className="glass-card rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", active ? "bg-primary/10" : "bg-muted")}>
              <MessageSquarePlus className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Resposta automática</h3>
              <p className="text-xs text-muted-foreground">Enviar automaticamente ao receber um novo contato</p>
            </div>
          </div>
          <button
            onClick={() => setActive(!active)}
            className={cn(
              "flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-full transition-colors",
              active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <ToggleRight className="w-4 h-4" />
            {active ? "Ativo" : "Inativo"}
          </button>
        </div>

        {active && (
          <>
            {/* Conexão */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Conexão</h3>
              <div className="grid grid-cols-2 gap-3">
                {CONEXOES.map(c => (
                  <button key={c.id} onClick={() => setSelectedConexao(c.id)} className={cn("glass-card rounded-xl p-4 flex items-center gap-3 transition-all", selectedConexao === c.id ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/60")}>
                    <Smartphone className={cn("w-5 h-5", selectedConexao === c.id ? "text-primary" : "text-muted-foreground")} />
                    <div className="text-left">
                      <span className={cn("text-sm font-medium block", selectedConexao === c.id ? "text-primary" : "text-foreground")}>{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.number}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de resposta */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Tipo de resposta</h3>
              <div className="grid grid-cols-3 gap-3">
                {responseOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setResponseType(opt.value)}
                    className={cn(
                      "glass-card rounded-xl p-4 flex flex-col items-center gap-2 transition-all text-center",
                      responseType === opt.value ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/60"
                    )}
                  >
                    <opt.icon className={cn("w-5 h-5", responseType === opt.value ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-xs font-medium", responseType === opt.value ? "text-primary" : "text-muted-foreground")}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mensagem de texto */}
            {(responseType === "text" || responseType === "both") && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Mensagem de boas-vindas</h3>
                <div className="glass-card rounded-xl p-5">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Digite a mensagem automática..."
                    rows={4}
                    className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Variáveis disponíveis: <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-[11px]">{"{{nome}}"}</code>{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-[11px]">{"{{numero}}"}</code>
                  </p>
                </div>
              </div>
            )}

            {/* Upload de áudio */}
            {(responseType === "audio" || responseType === "both") && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Áudio de boas-vindas</h3>
                <div className="glass-card rounded-xl p-5">
                  {audioFile ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{audioFile}</p>
                        <p className="text-xs text-muted-foreground">Áudio carregado</p>
                      </div>
                      <button onClick={() => setAudioFile(null)} className="text-xs text-destructive hover:underline">Remover</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAudioFile("audio-recepcao.mp3")}
                      className="w-full flex flex-col items-center gap-3 py-8 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
                    >
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">Clique para enviar um áudio</p>
                        <p className="text-xs text-muted-foreground mt-1">MP3, OGG ou WAV • Máx. 5MB</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* === RESPOSTAS POR ANÚNCIO === */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Respostas por Anúncio</h3>
                </div>
                <button
                  onClick={() => setShowAdForm(!showAdForm)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova regra
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure respostas automáticas para contatos que chegam por anúncios específicos.
              </p>

              {/* Existing rules */}
              <div className="space-y-2">
                {adRules.map(rule => (
                  <div key={rule.id} className="glass-card rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-chart-4/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Megaphone className="w-4 h-4 text-chart-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">Gatilho:</span>
                        <code className="bg-muted px-2 py-0.5 rounded text-primary text-[11px] font-mono">{rule.keyword}</code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{rule.message || "Áudio"}</p>
                      <span className="text-[10px] text-muted-foreground capitalize">{rule.responseType === "both" ? "Texto + Áudio" : rule.responseType === "text" ? "Texto" : "Áudio"}</span>
                    </div>
                    <button onClick={() => removeAdRule(rule.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* New rule form */}
              {showAdForm && (
                <div className="glass-card rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Palavra-chave / Gatilho</label>
                    <input value={adForm.keyword} onChange={(e) => setAdForm({ ...adForm, keyword: e.target.value })} placeholder="Ex: promo, desconto, oferta" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Tipo de resposta</label>
                    <div className="flex gap-2">
                      {responseOptions.map(opt => (
                        <button key={opt.value} onClick={() => setAdForm({ ...adForm, responseType: opt.value })} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", adForm.responseType === opt.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                          <opt.icon className="w-3.5 h-3.5" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(adForm.responseType === "text" || adForm.responseType === "both") && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Mensagem</label>
                      <textarea value={adForm.message} onChange={(e) => setAdForm({ ...adForm, message: e.target.value })} placeholder="Mensagem de resposta..." rows={2} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none" />
                    </div>
                  )}
                  {(adForm.responseType === "audio" || adForm.responseType === "both") && (
                    <button onClick={() => setAdForm({ ...adForm, audioFile: "audio-anuncio.mp3" })} className="w-full flex items-center gap-2 py-3 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer justify-center">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{adForm.audioFile || "Enviar áudio"}</span>
                    </button>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowAdForm(false)} className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                    <button onClick={addAdRule} className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Adicionar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Salvar */}
            <div className="flex justify-end">
              <button onClick={() => toast.success("Configuração salva com sucesso")} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
                <Save className="w-4 h-4" />
                Salvar Configuração
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
