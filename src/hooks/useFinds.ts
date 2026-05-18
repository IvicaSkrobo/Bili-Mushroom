import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFinds, updateFind, deleteFind, getSpeciesNotes, upsertSpeciesNote,
  getSpeciesProfiles, upsertSpeciesProfile, getSpeciesRecipes, upsertSpeciesRecipe, deleteSpeciesRecipe,
  bulkRenameSpecies, moveFindToFolder, setFindFavorite, addFindPhotos, createFind,
  deleteFindPhoto, bulkDeleteFindPhotos,
  FINDS_QUERY_KEY, SPECIES_NOTES_QUERY_KEY, SPECIES_PROFILES_QUERY_KEY, SPECIES_RECIPES_QUERY_KEY,
  type Find, type UpdateFindPayload, type CreateFindPayload,
} from '@/lib/finds';
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

export function useSpeciesNotes() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery({
    queryKey: [SPECIES_NOTES_QUERY_KEY, storagePath],
    queryFn: () => getSpeciesNotes(storagePath!),
    enabled: !!storagePath,
  });
}

export function useSpeciesProfiles() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery({
    queryKey: [SPECIES_PROFILES_QUERY_KEY, storagePath],
    queryFn: () => getSpeciesProfiles(storagePath!),
    enabled: !!storagePath,
  });
}

export function useSpeciesRecipes() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery({
    queryKey: [SPECIES_RECIPES_QUERY_KEY, storagePath],
    queryFn: () => getSpeciesRecipes(storagePath!),
    enabled: !!storagePath,
  });
}

export function useMoveFindToFolder() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findId, destFolder }: { findId: number; destFolder: string }) =>
      moveFindToFolder(storagePath!, findId, destFolder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}

export function useBulkMoveFindToFolder() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ findIds, destFolder }: { findIds: number[]; destFolder: string }) => {
      await Promise.all(findIds.map((id) => moveFindToFolder(storagePath!, id, destFolder)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}

export function useBulkDeleteFinds() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ findIds, deleteFiles }: { findIds: number[]; deleteFiles: boolean }) => {
      await Promise.all(findIds.map((id) => deleteFind(storagePath!, id, deleteFiles)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}

export function useBulkRenameSpecies() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findIds, newSpeciesName }: { findIds: number[]; newSpeciesName: string }) =>
      bulkRenameSpecies(storagePath!, findIds, newSpeciesName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
      qc.invalidateQueries({ queryKey: [SPECIES_NOTES_QUERY_KEY, storagePath] });
      qc.invalidateQueries({ queryKey: [SPECIES_PROFILES_QUERY_KEY, storagePath] });
    },
  });
}

export function useUpsertSpeciesNote() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ speciesName, notes }: { speciesName: string; notes: string }) =>
      upsertSpeciesNote(storagePath!, speciesName, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SPECIES_NOTES_QUERY_KEY, storagePath] });
    },
  });
}

export function useUpsertSpeciesProfile() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      speciesName,
      commonName,
      coverPhotoId,
      tags,
      edibility,
      threatStatus,
      distribution,
      edibilityNote,
      synonyms,
      otherNames,
      fruitingBodyCountOverride,
      description,
    }: {
      speciesName: string;
      commonName?: string | null;
      coverPhotoId: number | null;
      tags: string[];
      edibility?: string | null;
      threatStatus?: string | null;
      distribution?: string | null;
      edibilityNote?: string | null;
      synonyms?: string[];
      otherNames?: string[];
      fruitingBodyCountOverride?: string | null;
      description?: string | null;
    }) => upsertSpeciesProfile(storagePath!, speciesName, commonName, coverPhotoId, tags, edibility, threatStatus, distribution, edibilityNote, synonyms, otherNames, fruitingBodyCountOverride, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SPECIES_PROFILES_QUERY_KEY, storagePath] });
    },
  });
}

export function useUpsertSpeciesRecipe() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, speciesName, title, notes }: { id: number | null; speciesName: string; title: string; notes: string }) =>
      upsertSpeciesRecipe(storagePath!, id, speciesName, title, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SPECIES_RECIPES_QUERY_KEY, storagePath] });
    },
  });
}

export function useDeleteSpeciesRecipe() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSpeciesRecipe(storagePath!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SPECIES_RECIPES_QUERY_KEY, storagePath] });
    },
  });
}

export function useSetFindFavorite() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findId, isFavorite }: { findId: number; isFavorite: boolean }) =>
      setFindFavorite(storagePath!, findId, isFavorite),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}

export function useAddFindPhotos() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findId, sourcePaths }: { findId: number; sourcePaths: string[] }) =>
      addFindPhotos(storagePath!, findId, sourcePaths),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}

export function useCreateFind() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFindPayload) => createFind(storagePath!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}

export function useDeleteFindPhoto() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, deleteFile, permanentDelete = false }: { photoId: number; deleteFile: boolean; permanentDelete?: boolean }) =>
      deleteFindPhoto(storagePath!, photoId, deleteFile, permanentDelete),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}

export function useBulkDeleteFindPhotos() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ photoIds, deleteFiles, permanentDelete = false }: { photoIds: number[]; deleteFiles: boolean; permanentDelete?: boolean }) =>
      bulkDeleteFindPhotos(storagePath!, photoIds, deleteFiles, permanentDelete),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}
