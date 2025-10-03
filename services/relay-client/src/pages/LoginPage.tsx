import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

const API_BASE_URL = "http://localhost:5000";

export default function LoginPage() {
  const navigate = useNavigate();
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
        localStorage.setItem("token", loginResponse.data.token);
      } else {
        localStorage.setItem("token", response.data.token);
      }
      // Navigate to home page after successful login
      navigate("/");
      // Reload to update the authentication state
      window.location.reload();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "An error occurred.");
      } else {
        setError("An error occurred.");
      }
    }
  };

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
