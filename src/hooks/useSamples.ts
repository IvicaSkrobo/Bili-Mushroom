import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/appStore';
import { FINDS_QUERY_KEY } from '@/lib/finds';
import {
  createSampleForFind,
  deleteSample,
  getSampleForFind,
  getSamples,
  syncSampleFolder,
  updateSample,
  SAMPLES_QUERY_KEY,
  type Sample,
  type SampleUpdatePayload,
} from '@/lib/samples';

export function useSamples() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<Sample[]>({
    queryKey: [SAMPLES_QUERY_KEY, storagePath],
    queryFn: () => getSamples(storagePath!),
    enabled: !!storagePath,
  });
}

export function useSampleForFind(findId: number | null) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<Sample | null>({
    queryKey: [SAMPLES_QUERY_KEY, storagePath, 'find', findId],
    queryFn: () => getSampleForFind(storagePath!, findId!),
    enabled: !!storagePath && findId !== null,
  });
}

export function useCreateSampleForFind() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (findId: number) => createSampleForFind(storagePath!, findId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SAMPLES_QUERY_KEY, storagePath] });
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}

export function useUpdateSample() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SampleUpdatePayload) => updateSample(storagePath!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SAMPLES_QUERY_KEY, storagePath] });
    },
  });
}

export function useDeleteSample() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sampleId, deleteFolder }: { sampleId: number; deleteFolder: boolean }) =>
      deleteSample(storagePath!, sampleId, deleteFolder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SAMPLES_QUERY_KEY, storagePath] });
    },
  });
}

export function useSyncSampleFolder() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sampleId: number) => syncSampleFolder(storagePath!, sampleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SAMPLES_QUERY_KEY, storagePath] });
    },
  });
}
