export interface Lead {
  id: string;
  pipeline_id?: string;
  contact_id?: string | null;
  name: string;
  phone: string;
  email?: string;
  value: number;
  lastContact: string;
  tag?: string;
  company?: string;
  probability?: number;
  assignee?: string;
  createdAt?: string;
  notes?: string | null;
  position?: number;
}

export interface Pipeline {
  id: string;
  title: string;
  color?: string | null;
  position?: number;
  leads: Lead[];
}
