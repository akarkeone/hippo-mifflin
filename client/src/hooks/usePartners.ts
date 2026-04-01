import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { Partner, PartnerRating } from '../types';

export function usePartners(filters?: { speciality?: string; category?: string }) {
  return useQuery<Partner[]>({
    queryKey: ['partners', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.speciality) params.set('speciality', filters.speciality);
      if (filters?.category) params.set('category', filters.category);
      const res = await api.get(`/partners?${params}`);
      return res.data;
    },
  });
}

export function usePartner(id: string | null) {
  return useQuery<Partner>({
    queryKey: ['partner', id],
    queryFn: async () => {
      const res = await api.get(`/partners/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function usePartnerRatings(id: string | null) {
  return useQuery<PartnerRating[]>({
    queryKey: ['partner-ratings', id],
    queryFn: async () => {
      const res = await api.get(`/partners/${id}/ratings`);
      return res.data;
    },
    enabled: !!id,
  });
}
