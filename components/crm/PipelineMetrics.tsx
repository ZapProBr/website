"use client";

import { Pipeline } from "@/components/crm/types";
import { TrendingUp, Users, Target, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineMetricsProps {
  pipelines: Pipeline[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

export function PipelineMetrics({ pipelines }: PipelineMetricsProps) {
  const totalLeads = pipelines.reduce((sum, p) => sum + p.leads.length, 0);
  const totalValue = pipelines.reduce((sum, p) => sum + p.leads.reduce((s, l) => s + l.value, 0), 0);
  const closedValue = pipelines.find((p) => p.id === "closed")?.leads.reduce((s, l) => s + l.value, 0) || 0;
  const avgProbability = totalLeads > 0
    ? Math.round(pipelines.reduce((sum, p) => sum + p.leads.reduce((s, l) => s + (l.probability || 0), 0), 0) / totalLeads)
    : 0;
  const weightedValue = pipelines.reduce(
    (sum, p) => sum + p.leads.reduce((s, l) => s + l.value * ((l.probability || 0) / 100), 0), 0
  );

  const metrics = [
    { label: "Total de Leads", value: totalLeads.toString(), icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Pipeline Total", value: formatCurrency(totalValue), icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Previsão Ponderada", value: formatCurrency(weightedValue), icon: Target, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Receita Fechada", value: formatCurrency(closedValue), icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="flex items-center gap-3 rounded-xl bg-card border border-border/50 px-4 py-3 shadow-sm">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", m.bg)}>
            <m.icon className={cn("w-4 h-4", m.color)} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">{m.label}</p>
            <p className="text-sm font-bold text-foreground">{m.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
