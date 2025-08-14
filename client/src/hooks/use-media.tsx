import { useQuery } from "@tanstack/react-query";
import type { MediaItemWithTags, MediaSearchParams } from "@shared/schema";

export function useMediaItems(params: MediaSearchParams) {
  const queryParams = new URLSearchParams();
  
  if (params.search) queryParams.append("search", params.search);
  if (params.tags) params.tags.forEach(tag => queryParams.append("tags", tag));
  if (params.type) queryParams.append("type", params.type);
  if (params.sizeRange) queryParams.append("sizeRange", params.sizeRange);
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.limit) queryParams.append("limit", params.limit.toString());

  const queryString = queryParams.toString();
  const url = queryString ? `/api/media?${queryString}` : "/api/media";

  return useQuery<{ items: MediaItemWithTags[]; total: number }>({
    queryKey: [url],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useMediaItem(id: string) {
  return useQuery<MediaItemWithTags>({
    queryKey: ["/api/media", id],
    enabled: !!id,
  });
}
