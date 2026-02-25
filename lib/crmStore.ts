import { Pipeline, Lead } from "@/components/crm/types";
import { initialPipelines } from "@/components/crm/data";

// Shared mutable pipeline store (same pattern as tagStore)
let pipelineStore: Pipeline[] = JSON.parse(JSON.stringify(initialPipelines));

export const getPipelineStore = (): Pipeline[] => pipelineStore;
export const setPipelineStore = (pipelines: Pipeline[]): void => { pipelineStore = pipelines; };

/** Add or move a lead into a specific stage */
export const upsertLeadToStage = (stageId: string, lead: Lead): void => {
  // Remove from any existing stage first
  pipelineStore = pipelineStore.map((p) => ({
    ...p,
    leads: p.leads.filter((l) => l.id !== lead.id),
  }));
  // Add to target stage
  pipelineStore = pipelineStore.map((p) =>
    p.id === stageId ? { ...p, leads: [...p.leads, lead] } : p
  );
};

/** Remove a lead entirely */
export const removeLeadFromPipeline = (leadId: string): void => {
  pipelineStore = pipelineStore.map((p) => ({
    ...p,
    leads: p.leads.filter((l) => l.id !== leadId),
  }));
};

/** Find which stage a lead is in */
export const findLeadStage = (leadId: string): string | null => {
  for (const p of pipelineStore) {
    if (p.leads.some((l) => l.id === leadId)) return p.id;
  }
  return null;
};

/** Find lead by name (for conversation contacts) */
export const findLeadByName = (name: string): Lead | null => {
  for (const p of pipelineStore) {
    const lead = p.leads.find((l) => l.name === name);
    if (lead) return lead;
  }
  return null;
};
