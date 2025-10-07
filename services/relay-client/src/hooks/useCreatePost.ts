import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, getErrorMessage } from "../lib/apiClient";
import { postsQueryKey } from "./usePosts";

/**
 * Types for creating a post
 */
interface CreatePostData {
  title: string;
  url: string;
}

/**
 * Create a new post
 */
const createPost = async (data: CreatePostData): Promise<void> => {
  const api = createApiClient();
  await api.post("/api/posts", data);
};

/**
 * Custom hook for creating a post
 *
 * Features:
 * - Automatic cache invalidation (refetches posts)
 * - Error handling
 * - Loading states
 * - Requires authentication
 *
 * @returns Mutation object with createPost function and states
 */
export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      // Invalidate and refetch posts after creating a new one
      queryClient.invalidateQueries({ queryKey: postsQueryKey });
    },
    onError: (error) => {
      console.error("Failed to create post:", getErrorMessage(error));
    },
  });
};
