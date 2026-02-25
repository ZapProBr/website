import { Pipeline } from "./types";

export const initialPipelines: Pipeline[] = [
  {
    id: "qualified",
    title: "Leads Qualificados",
    leads: [
      { id: "1", name: "João Silva", phone: "(11) 99999-1234", email: "joao@empresa.com", value: 2500, lastContact: "Há 2h", tag: "Quente", company: "Tech Solutions", probability: 20, assignee: "VS" },
      { id: "2", name: "Maria Souza", phone: "(21) 98888-5678", email: "maria@startup.io", value: 1800, lastContact: "Há 5h", company: "Startup.io", probability: 15, assignee: "AL" },
    ],
  },
  {
    id: "contact",
    title: "Contato Realizado",
    leads: [
      { id: "4", name: "Ana Costa", phone: "(41) 96666-3456", email: "ana@vipgroup.com", value: 5000, lastContact: "Há 3h", tag: "VIP", company: "VIP Group", probability: 40, assignee: "MR" },
    ],
  },
  {
    id: "proposal",
    title: "Proposta Enviada",
    leads: [
      { id: "5", name: "Pedro Rocha", phone: "(51) 95555-7890", value: 3200, lastContact: "Há 1d", company: "Rocha Digital", probability: 55, assignee: "VS" },
    ],
  },
  {
    id: "negotiation",
    title: "Em Negociação",
    leads: [
      { id: "3", name: "Carlos Lima", phone: "(31) 97777-9012", value: 4200, lastContact: "Há 1d", tag: "Indicação", company: "Lima & Assoc.", probability: 75, assignee: "VS" },
    ],
  },
  {
    id: "closed",
    title: "Fechado/Ganho",
    leads: [],
  },
];

export const tagColors: Record<string, string> = {
  Quente: "bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20",
  Indicação: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20",
  VIP: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20",
  Recorrente: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20",
  Enterprise: "bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500/20",
};

export const stageColors: Record<string, { bar: string; bg: string; text: string }> = {
  qualified: { bar: "bg-blue-500", bg: "bg-blue-500/8", text: "text-blue-600" },
  contact: { bar: "bg-cyan-500", bg: "bg-cyan-500/8", text: "text-cyan-600" },
  proposal: { bar: "bg-amber-500", bg: "bg-amber-500/8", text: "text-amber-600" },
  negotiation: { bar: "bg-purple-500", bg: "bg-purple-500/8", text: "text-purple-600" },
  closed: { bar: "bg-emerald-500", bg: "bg-emerald-500/8", text: "text-emerald-600" },
};
