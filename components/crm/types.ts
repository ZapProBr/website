export interface Lead {
  id: string;
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
}

export interface Pipeline {
  id: string;
  title: string;
  leads: Lead[];
}
