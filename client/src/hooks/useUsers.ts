import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { User } from '../types';

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });
}
