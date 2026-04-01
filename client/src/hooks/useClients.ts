import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { Client } from '../types';

export function useClients() {
  return useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/clients');
      return res.data;
    },
  });
}
