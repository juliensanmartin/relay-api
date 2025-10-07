import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createApiClient,
  getErrorMessage,
  isConflictError,
} from "../lib/apiClient";
import { postsQueryKey } from "./usePosts";
import type { Post } from "../types";

/**
 * Upvote a post
 */
const upvotePost = async (postId: number): Promise<void> => {
  const api = createApiClient();
  await api.post(`/api/posts/${postId}/upvote`);
};

/**
 * Custom hook for upvoting posts with optimistic updates
 *
 * Features:
 * - Optimistic UI updates (instant feedback)
 * - Automatic rollback on error
 * - Error handling with specific conflict detection
 * - Requires authentication
 *
 * How optimistic updates work:
 * 1. User clicks upvote
 * 2. UI updates immediately (optimistic)
 * 3. API request sent in background
 * 4. If successful: UI stays updated
 * 5. If failed: UI rolls back to previous state
 *
 * @returns Mutation object with upvote function and states
 */
export const useUpvote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upvotePost,

    // Optimistic update: Update UI before API call completes
    onMutate: async (postId: number) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: postsQueryKey });

      // Snapshot the previous value (for rollback)
      const previousPosts = queryClient.getQueryData<Post[]>(postsQueryKey);

      // Optimistically update the cache
      queryClient.setQueryData<Post[]>(postsQueryKey, (old) => {
        if (!old) return old;
        return old.map((post) =>
          post.id === postId
            ? { ...post, upvote_count: post.upvote_count + 1 }
            : post
        );
      });

      // Return context with previous value for rollback
      return { previousPosts };
    },

    // On error: Rollback to previous state
    onError: (error, _postId, context) => {
      // Restore previous posts on error
      if (context?.previousPosts) {
        queryClient.setQueryData(postsQueryKey, context.previousPosts);
      }

      // Log specific error message
      if (isConflictError(error)) {
        console.error("You have already upvoted this post");
      } else {
        console.error("Failed to upvote:", getErrorMessage(error));
      }
    },

    // Always refetch after error or success to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: postsQueryKey });
    },
  });
};
