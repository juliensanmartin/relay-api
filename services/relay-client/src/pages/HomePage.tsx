import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import PostList from "../components/PostList";
import CreatePostForm from "../components/CreatePostForm";
import { usePosts } from "../hooks/usePosts";
import { useCreatePost } from "../hooks/useCreatePost";
import { useUpvote } from "../hooks/useUpvote";
import { useLogout } from "../hooks/useAuth";
import {
  getAuthToken,
  isAuthError,
  isConflictError,
  getErrorMessage,
} from "../lib/apiClient";

export default function HomePage() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const [error, setError] = useState<string>("");

  // React Query hooks
  const { data: posts = [], isLoading, error: postsError } = usePosts();
  const createPostMutation = useCreatePost();
  const upvoteMutation = useUpvote();
  const logout = useLogout();

  const handleLogout = () => {
    logout();
  };

  const handleCreatePost = async (title: string, url: string) => {
    if (!token) {
      setError("You must be logged in to create a post.");
      navigate("/login");
      return;
    }

    try {
      await createPostMutation.mutateAsync({ title, url });
      setError("");
    } catch (err) {
      const message = getErrorMessage(err);
      setError(`Failed to create post: ${message}`);

      if (isAuthError(err)) {
        handleLogout();
        navigate("/login");
      }
    }
  };

  const handleUpvote = async (postId: number) => {
    if (!token) {
      setError("You must be logged in to upvote.");
      navigate("/login");
      return;
    }

    try {
      await upvoteMutation.mutateAsync(postId);
      setError("");
    } catch (err) {
      if (isConflictError(err)) {
        setError("You have already upvoted this post.");
      } else if (isAuthError(err)) {
        setError("Session expired. Please log in again.");
        handleLogout();
        navigate("/login");
      } else {
        setError(`Failed to upvote: ${getErrorMessage(err)}`);
      }
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-lg text-gray-600">Loading posts...</div>
      </div>
    );
  }

  // Show error state
  if (postsError) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-lg text-red-600">
          Failed to load posts. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 font-sans">
      <Header isLoggedIn={!!token} onLogout={handleLogout} />

      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          {error}
          <button
            onClick={() => setError("")}
            className="absolute top-0 right-0 px-4 py-3"
          >
            ×
          </button>
        </div>
      )}

      {token && <CreatePostForm onCreate={handleCreatePost} />}

      <PostList
        posts={posts}
        onUpvote={handleUpvote}
        isLoggedIn={!!token}
        isUpvoting={upvoteMutation.isPending}
      />
    </div>
  );
}
