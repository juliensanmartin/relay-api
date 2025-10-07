import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useRegister, useLogin } from "../hooks/useAuth";
import { getErrorMessage } from "../lib/apiClient";

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // React Query hooks
  const registerMutation = useRegister();
  const loginMutation = useLogin();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isRegister) {
        await registerMutation.mutateAsync({ username, email, password });
      } else {
        await loginMutation.mutateAsync({ email, password });
      }

      // Navigate to home page after successful login
      navigate("/");
      // Reload to update the authentication state
      window.location.reload();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const isLoading = registerMutation.isPending || loginMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <Link
            to="/"
            className="text-3xl font-bold text-gray-800 hover:text-gray-600"
          >
            Relay
          </Link>
        </div>
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
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? "Loading..." : isRegister ? "Register" : "Login"}
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
        <Link
          to="/"
          className="block text-center text-gray-600 hover:underline"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
