import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { ProjectListItem, Project } from '../types';

export function useProjects(filters?: { status?: string; client_id?: string; category?: string }) {
  return useQuery<ProjectListItem[]>({
    queryKey: ['projects', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.client_id) params.set('client_id', filters.client_id);
      if (filters?.category) params.set('category', filters.category);
      const res = await api.get(`/projects?${params}`);
      return res.data;
    },
  });
}

export function useProject(id: string) {
  return useQuery<Project>({
    queryKey: ['project', id],
    queryFn: async () => {
      const res = await api.get(`/projects/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}
