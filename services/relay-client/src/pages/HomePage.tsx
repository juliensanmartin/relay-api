import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "../components/Header";
import PostList from "../components/PostList";
import CreatePostForm from "../components/CreatePostForm";
import type { Post } from "../types";

const API_BASE_URL = "http://localhost:5000";

export default function HomePage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // An axios instance with the auth header
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  // Fetch posts on mount
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      // No authentication needed to fetch posts
      const response = await axios.get<Post[]>(`${API_BASE_URL}/api/posts`);
      setPosts(response.data);
      setError("");
    } catch {
      setError("Failed to fetch posts.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  const handleCreatePost = async (title: string, url: string) => {
    if (!token) {
      setError("You must be logged in to create a post.");
      navigate("/login");
      return;
    }
    try {
      await api.post("/api/posts", { title, url });
      fetchPosts(); // Refresh the list after creating a post
      setError("");
    } catch (err) {
      setError("Failed to create post. Please try logging in again.");
      if (axios.isAxiosError(err) && err.response?.status === 401) {
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
      await api.post(`/api/posts/${postId}/upvote`);
      // Optimistically update the UI for a better user experience
      setPosts(
        posts.map((p) =>
          p.id === postId ? { ...p, upvote_count: p.upvote_count + 1 } : p
        )
      );
      setError("");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          setError("You have already upvoted this post.");
        } else if (err.response?.status === 401) {
          setError("Session expired. Please log in again.");
          handleLogout();
          navigate("/login");
        } else {
          setError("Failed to upvote post.");
        }
      } else {
        setError("Failed to upvote post.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
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

      <PostList posts={posts} onUpvote={handleUpvote} isLoggedIn={!!token} />
    </div>
  );
}
