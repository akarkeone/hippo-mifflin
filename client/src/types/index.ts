export type Role = 'EP' | 'PRODUCER' | 'ASSOC_PRODUCER' | 'INTERN';
export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface User {
  id: string;
  email: string;
  name: string;
  title?: string | null;
  role: Role;
  created_at?: string;
}

export interface Client {
  id: string;
  name: string;
  color_hex: string;
  logo_url?: string | null;
  projects?: ProjectSummary[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  client?: { id: string; name: string };
}

export interface TeamMember {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  post: boolean;
}

export interface ProjectMember {
  id: string;
  team_member_id: string;
  role_label: string | null;
  team_member: { id: string; name: string; title: string | null };
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  status: ProjectStatus;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  client: Client;
  categories: { category: Category }[];
  team_members: { user: User; role_label: string | null }[];
  members: ProjectMember[];
  budget_items: BudgetLineItem[];
  milestones: Milestone[];
  partners: { partner: Partner }[];
  assets: Asset[];
}

export interface ProjectListItem {
  id: string;
  client_id: string;
  name: string;
  status: ProjectStatus;
  due_date: string | null;
  client: Client;
  categories: { category: Category }[];
  team_members: { user: { id: string; name: string } }[];
  members: { team_member: { id: string; name: string; title: string | null; post: boolean } }[];
  budget_items: { amount_cents: number }[];
  milestones: { id: string; name: string; completed: boolean; start_date: string | null; end_date: string | null; tm_assignee_id?: string | null; tm_assignee?: { id: string; name: string } | null }[];
}

export interface BudgetLineItem {
  id: string;
  project_id: string;
  label: string;
  description: string | null;
  amount_cents: number;
  actuals_cents: number;
  is_agency_fee: boolean;
  sort_order: number | null;
}

export interface Milestone {
  id: string;
  project_id: string;
  assignee_id: string | null;
  tm_assignee_id: string | null;
  name: string;
  start_date: string | null;
  end_date: string | null;
  completed: boolean;
  sort_order: number | null;
  assignee?: { id: string; name: string } | null;
  tm_assignee?: { id: string; name: string } | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface Partner {
  id: string;
  company_name: string;
  type: string | null;
  location: string | null;
  notes: string | null;
  contacts: PartnerContact[];
  specialities: { id: string; name: string }[];
  categories: { category: Category }[];
  projects?: { project: ProjectSummary }[];
  project_count?: number;
  avg_rating?: number | null;
}

export interface PartnerContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface PartnerRating {
  id: string;
  partner_id: string;
  project_id: string;
  speed_efficiency: number;
  budget_flexibility: number;
  creativity: number;
  onset_performance: number;
  project?: { id: string; name: string };
  rater?: { id: string; name: string };
}

export interface Asset {
  id: string;
  label: string;
  url: string;
}

export interface ScoutResult {
  company_name: string;
  location: string;
  type: string;
  ep_name: string;
  ep_email: string;
  ep_phone: string;
  website: string;
  specialities: string[];
  categories: string[];
}
