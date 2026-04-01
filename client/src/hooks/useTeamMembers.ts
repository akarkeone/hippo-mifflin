import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { TeamMember } from '../types';

export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await api.get('/team-members');
      return res.data;
    },
  });
}
