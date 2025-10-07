import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { Post } from "../types";

/**
 * Query key for posts
 */
export const postsQueryKey = ["posts"] as const;

/**
 * Fetch all posts from the API
 */
const fetchPosts = async (): Promise<Post[]> => {
  const response = await apiClient.get<Post[]>("/api/posts");
  return response.data;
};

/**
 * Custom hook to fetch posts
 *
 * Features:
 * - Automatic caching (5 min stale time)
 * - Background refetching
 * - Loading and error states
 * - Automatic retries on failure
 *
 * @returns Query result with posts, loading, and error states
 */
export const usePosts = () => {
  return useQuery({
    queryKey: postsQueryKey,
    queryFn: fetchPosts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
