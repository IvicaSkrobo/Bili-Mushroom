import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFinds, getFindLocations, getMapPoints, getSpeciesOptions, getCollectionFolders, getSpeciesFinds, updateFind, deleteFind, getFindPhotos, getSpeciesNotes, getSpeciesNote, upsertSpeciesNote,
  getSpeciesProfiles, getSpeciesProfile, getSpeciesProfileSummaries, upsertSpeciesProfile, patchSpeciesProfile, getSpeciesRecipes, getSpeciesRecipesForSpecies, upsertSpeciesRecipe, deleteSpeciesRecipe,
  bulkRenameSpecies, renameSpeciesFolder, moveFindToFolder, bulkMoveFindsToFolder, bulkDeleteFinds, setFindFavorite, addFindPhotos, createFind,
  deleteFindPhoto, bulkDeleteFindPhotos,
  FINDS_QUERY_KEY, SPECIES_NOTES_QUERY_KEY, SPECIES_PROFILES_QUERY_KEY, SPECIES_RECIPES_QUERY_KEY,
  type Find, type FindSearchFilters, type MapPoint, type SpeciesOption, type SpeciesProfilePatch, type UpdateFindPayload, type CreateFindPayload,
} from '@/lib/finds';
import { SAMPLES_QUERY_KEY } from '@/lib/samples';
import { useAppStore } from '@/stores/appStore';

export function useFinds(filters?: FindSearchFilters, enabled = true) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<Find[]>({
    queryKey: [FINDS_QUERY_KEY, storagePath, filters ?? null],
    queryFn: () => getFinds(storagePath!, filters),
    enabled: !!storagePath && enabled,
  });
}

/**
 * Species autocomplete source. Replaces the old pattern of loading every find plus
 * every species profile just to build a suggestion list.
 */
export function useSpeciesOptions(enabled = true) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<SpeciesOption[]>({
    queryKey: [FINDS_QUERY_KEY, storagePath, 'species-options'],
    queryFn: () => getSpeciesOptions(storagePath!),
    enabled: !!storagePath && enabled,
    staleTime: 60_000,
  });
}

/**
 * Pins for the map. Replaces loading every find with its photo rows just to read four
 * fields off each one.
 */
export function useMapPoints(enabled = true) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<MapPoint[]>({
    queryKey: [FINDS_QUERY_KEY, storagePath, 'map-points'],
    queryFn: () => getMapPoints(storagePath!),
    enabled: !!storagePath && enabled,
  });
}

export function useFindLocations() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<string[]>({
    queryKey: [FINDS_QUERY_KEY, storagePath, 'locations'],
    queryFn: () => getFindLocations(storagePath!),
    enabled: !!storagePath,
    staleTime: 5 * 60_000,
  });
}

export function useInfiniteFinds(filters?: FindSearchFilters, pageSize = 200) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useInfiniteQuery({
    queryKey: [FINDS_QUERY_KEY, storagePath, 'infinite', filters ?? null, pageSize],
    queryFn: ({ pageParam }) =>
      getFinds(storagePath!, {
        ...filters,
        limit: pageSize,
        offset: pageParam * pageSize,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === pageSize ? allPages.length : undefined,
    enabled: !!storagePath,
  });
}

export function useInfiniteCollectionFolders(filters?: FindSearchFilters, pageSize = 200) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useInfiniteQuery({
    queryKey: [FINDS_QUERY_KEY, storagePath, 'folders', filters ?? null, pageSize],
    queryFn: ({ pageParam }) =>
      getCollectionFolders(storagePath!, {
        ...filters,
        limit: pageSize,
        offset: pageParam * pageSize,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === pageSize ? allPages.length : undefined,
    enabled: !!storagePath,
  });
}

export function useInfiniteSpeciesFinds(speciesName: string | null, filters?: FindSearchFilters, pageSize = 100, enabled = true) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useInfiniteQuery({
    queryKey: [FINDS_QUERY_KEY, storagePath, 'species-finds', speciesName, filters ?? null, pageSize],
    queryFn: ({ pageParam }) =>
      getSpeciesFinds(storagePath!, speciesName!, {
        ...filters,
        photosMode: filters?.photosMode ?? 'primary',
        limit: pageSize,
        offset: pageParam * pageSize,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === pageSize ? allPages.length : undefined,
    enabled: !!storagePath && !!speciesName && enabled,
  });
}

export function useSpeciesFinds(speciesName: string | null, filters?: FindSearchFilters, enabled = true) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<Find[]>({
    queryKey: [FINDS_QUERY_KEY, storagePath, 'species-finds-all', speciesName, filters ?? null],
    queryFn: () => getSpeciesFinds(storagePath!, speciesName!, filters),
    enabled: !!storagePath && !!speciesName && enabled,
  });
}

export function useFindPhotos(findId: number, enabled = true) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery({
    queryKey: [FINDS_QUERY_KEY, storagePath, 'photos', findId],
    queryFn: () => getFindPhotos(storagePath!, findId),
    enabled: !!storagePath && enabled,
    staleTime: 60_000,
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
    mutationFn: ({
      findId,
      deleteFiles,
      deleteSampleFolder,
    }: {
      findId: number;
      deleteFiles: boolean;
      deleteSampleFolder?: boolean;
    }) => deleteFind(storagePath!, findId, deleteFiles, deleteSampleFolder ?? false),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
      qc.invalidateQueries({ queryKey: [SAMPLES_QUERY_KEY, storagePath] });
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

export function useSpeciesNote(speciesName: string | null) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery({
    queryKey: [SPECIES_NOTES_QUERY_KEY, storagePath, speciesName],
    queryFn: () => getSpeciesNote(storagePath!, speciesName!),
    enabled: !!storagePath && !!speciesName,
    staleTime: 60_000,
  });
}

export function useSpeciesProfiles(enabled = true) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery({
    queryKey: [SPECIES_PROFILES_QUERY_KEY, storagePath],
    queryFn: () => getSpeciesProfiles(storagePath!),
    enabled: !!storagePath && enabled,
  });
}

export function useSpeciesProfileSummaries(enabled = true) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery({
    queryKey: [SPECIES_PROFILES_QUERY_KEY, storagePath, 'summaries'],
    queryFn: () => getSpeciesProfileSummaries(storagePath!),
    enabled: !!storagePath && enabled,
    staleTime: 60_000,
  });
}

export function useSpeciesProfile(speciesName: string | null) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery({
    queryKey: [SPECIES_PROFILES_QUERY_KEY, storagePath, speciesName],
    queryFn: () => getSpeciesProfile(storagePath!, speciesName!),
    enabled: !!storagePath && !!speciesName,
    staleTime: 60_000,
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

export function useSpeciesRecipesForSpecies(speciesName: string | null) {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery({
    queryKey: [SPECIES_RECIPES_QUERY_KEY, storagePath, speciesName],
    queryFn: () => getSpeciesRecipesForSpecies(storagePath!, speciesName!),
    enabled: !!storagePath && !!speciesName,
    staleTime: 60_000,
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
      await bulkMoveFindsToFolder(storagePath!, findIds, destFolder);
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
      await bulkDeleteFinds(storagePath!, findIds, deleteFiles);
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
      qc.invalidateQueries({ queryKey: [SAMPLES_QUERY_KEY, storagePath] });
    },
  });
}

export function useRenameSpeciesFolder() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ oldSpeciesName, newSpeciesName }: { oldSpeciesName: string; newSpeciesName: string }) =>
      renameSpeciesFolder(storagePath!, oldSpeciesName, newSpeciesName),
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
      habitat,
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
      habitat?: string | null;
    }) => upsertSpeciesProfile(storagePath!, speciesName, commonName, coverPhotoId, tags, edibility, threatStatus, distribution, edibilityNote, synonyms, otherNames, fruitingBodyCountOverride, description, habitat),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SPECIES_PROFILES_QUERY_KEY, storagePath] });
    },
  });
}

/**
 * Edits part of a species profile and leaves the rest alone. Prefer this over
 * useUpsertSpeciesProfile anywhere the screen does not own the whole profile.
 */
export function usePatchSpeciesProfile() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ speciesName, patch }: { speciesName: string; patch: SpeciesProfilePatch }) =>
      patchSpeciesProfile(storagePath!, speciesName, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SPECIES_PROFILES_QUERY_KEY, storagePath] });
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
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
