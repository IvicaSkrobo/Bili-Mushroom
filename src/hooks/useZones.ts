import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/appStore';
import {
  deleteZone,
  getZones,
  upsertZone,
  ZONES_QUERY_KEY,
  type UpsertZonePayload,
  type Zone,
} from '@/lib/zones';

export function useZones() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<Zone[]>({
    queryKey: [ZONES_QUERY_KEY, storagePath],
    queryFn: () => getZones(storagePath!),
    enabled: !!storagePath,
  });
}

export function useUpsertZone() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertZonePayload) => upsertZone(storagePath!, payload),
    onSuccess: (savedZone) => {
      qc.setQueryData<Zone[]>([ZONES_QUERY_KEY, storagePath], (current = []) => {
        const index = current.findIndex((zone) => zone.id === savedZone.id);
        if (index === -1) return [savedZone, ...current];
        return current.map((zone) => (zone.id === savedZone.id ? savedZone : zone));
      });
      qc.invalidateQueries({ queryKey: [ZONES_QUERY_KEY, storagePath] });
    },
  });
}

export function useDeleteZone() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: number) => deleteZone(storagePath!, zoneId),
    onSuccess: (_result, zoneId) => {
      qc.setQueryData<Zone[]>([ZONES_QUERY_KEY, storagePath], (current = []) =>
        current.filter((zone) => zone.id !== zoneId),
      );
      qc.invalidateQueries({ queryKey: [ZONES_QUERY_KEY, storagePath] });
    },
  });
}
