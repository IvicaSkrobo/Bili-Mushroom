import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFinds, updateFind, deleteFind, FINDS_QUERY_KEY, type Find, type UpdateFindPayload } from '@/lib/finds';
import { useAppStore } from '@/stores/appStore';

export function useFinds() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<Find[]>({
    queryKey: [FINDS_QUERY_KEY, storagePath],
    queryFn: () => getFinds(storagePath!),
    enabled: !!storagePath,
  });
}

export function useUpdateFind() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateFindPayload) => updateFind(storagePath!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}

export function useDeleteFind() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findId, deleteFiles }: { findId: number; deleteFiles: boolean }) =>
      deleteFind(storagePath!, findId, deleteFiles),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}
