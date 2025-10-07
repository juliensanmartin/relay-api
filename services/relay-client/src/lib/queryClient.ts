import { QueryClient } from "@tanstack/react-query";

/**
 * React Query client configuration with optimal defaults
 *
 * Stale time: How long data is considered fresh (5 minutes)
 * Cache time: How long unused data stays in cache (10 minutes)
 * Retry: Exponential backoff for failed queries
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Unused data stays in cache for 10 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)

      // Retry failed requests with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Don't refetch on window focus in development (reduces noise)
      refetchOnWindowFocus: false,

      // Refetch on mount if data is stale
      refetchOnMount: true,

      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
      retryDelay: 1000,
    },
  },
});
