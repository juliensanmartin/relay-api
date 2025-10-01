import { useState, useEffect, FormEvent } from "react";
import axios from "axios";

// =================================================================
// Configuration
// =================================================================
const API_BASE_URL = "http://localhost:5000"; // Our API Gateway

// =================================================================
// Main App Component
// =================================================================
export default function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [posts, setPosts] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // An axios instance with the auth header
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  useEffect(() => {
    if (token) {
      fetchPosts();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/api/posts");
      setPosts(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch posts. Your session might have expired.");
      handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setPosts([]);
  };

  const handleCreatePost = async (title: string, url: string) => {
    try {
      await api.post("/api/posts", { title, url });
      fetchPosts(); // Refresh the list after creating a post
    } catch (err) {
      setError("Failed to create post.");
    }
  };

  const handleUpvote = async (postId: number) => {
    try {
      await api.post(`/api/posts/${postId}/upvote`);
      // Optimistically update the UI for a better user experience
      setPosts(
        posts.map((p) =>
          p.id === postId ? { ...p, upvote_count: p.upvote_count + 1 } : p
        )
      );
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError("You have already upvoted this post.");
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

  if (!token) {
    return <LoginRegisterScreen onLogin={handleLogin} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 font-sans">
      <header className="flex justify-between items-center mb-6 pb-4 border-b">
        <h1 className="text-3xl font-bold text-gray-800">Relay</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Logout
        </button>
      </header>

      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          {error}
        </div>
      )}

      <CreatePostForm onCreate={handleCreatePost} />

      <PostList posts={posts} onUpvote={handleUpvote} />
    </div>
  );
}

// =================================================================
// Child Components
// =================================================================

function LoginRegisterScreen({
  onLogin,
}: {
  onLogin: (token: string) => void;
}) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const url = isRegister ? "/api/auth/users" : "/api/auth/login";
    const payload = isRegister
      ? { username, email, password }
      : { email, password };

    try {
      const response = await axios.post(`${API_BASE_URL}${url}`, payload);
      if (isRegister) {
        // After registering, automatically log in
        const loginResponse = await axios.post(
          `${API_BASE_URL}/api/auth/login`,
          { email, password }
        );
        onLogin(loginResponse.data.token);
      } else {
        onLogin(response.data.token);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "An error occurred.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center">
          {isRegister ? "Create Account" : "Sign In"}
        </h2>
        {error && <p className="text-red-500 text-center">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          {isRegister && (
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              className="w-full px-4 py-2 border rounded-md"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-4 py-2 border rounded-md"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full px-4 py-2 border rounded-md"
          />
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md"
          >
            {isRegister ? "Register" : "Login"}
          </button>
        </form>
        <p className="text-center">
          {isRegister ? "Already have an account?" : "Don't have an account?"}
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="ml-2 text-blue-600 hover:underline"
          >
            {isRegister ? "Login" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}

function CreatePostForm({
  onCreate,
}: {
  onCreate: (title: string, url: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onCreate(title, url);
    setTitle("");
    setUrl("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 p-4 bg-gray-50 rounded-lg shadow"
    >
      <h3 className="text-xl font-semibold mb-4">Create a New Post</h3>
      <div className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          className="w-full px-4 py-2 border rounded-md"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL"
          required
          className="w-full px-4 py-2 border rounded-md"
        />
        <button
          type="submit"
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md"
        >
          Submit Post
        </button>
      </div>
    </form>
  );
}

function PostList({
  posts,
  onUpvote,
}: {
  posts: any[];
  onUpvote: (postId: number) => void;
}) {
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div
          key={post.id}
          className="p-4 bg-white rounded-lg shadow-md flex items-center justify-between"
        >
          <div className="flex items-center">
            <button
              onClick={() => onUpvote(post.id)}
              className="mr-4 flex flex-col items-center"
            >
              <span className="text-2xl">▲</span>
              <span>{post.upvote_count}</span>
            </button>
            <div>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-blue-700 hover:underline"
              >
                {post.title}
              </a>
              <p className="text-sm text-gray-500">
                submitted by {post.username}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
