import { useMutation } from "@tanstack/react-query";
import {
  apiClient,
  setAuthToken,
  removeAuthToken,
  getErrorMessage,
} from "../lib/apiClient";

/**
 * Types for authentication
 */
interface RegisterData {
  username: string;
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user?: {
    id: number;
    username: string;
    email: string;
  };
}

/**
 * Register a new user
 */
const registerUser = async (data: RegisterData): Promise<AuthResponse> => {
  // First register
  await apiClient.post("/api/auth/users", data);

  // Then automatically log in
  const loginResponse = await apiClient.post<AuthResponse>("/api/auth/login", {
    email: data.email,
    password: data.password,
  });

  return loginResponse.data;
};

/**
 * Log in an existing user
 */
const loginUser = async (data: LoginData): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>("/api/auth/login", data);
  return response.data;
};

/**
 * Custom hook for user registration
 *
 * Features:
 * - Automatic token storage
 * - Error handling
 * - Loading states
 * - Success callbacks
 *
 * @returns Mutation object with register function and states
 */
export const useRegister = () => {
  return useMutation({
    mutationFn: registerUser,
    onSuccess: (data) => {
      setAuthToken(data.token);
    },
    onError: (error) => {
      console.error("Registration failed:", getErrorMessage(error));
    },
  });
};

/**
 * Custom hook for user login
 *
 * Features:
 * - Automatic token storage
 * - Error handling
 * - Loading states
 * - Success callbacks
 *
 * @returns Mutation object with login function and states
 */
export const useLogin = () => {
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      setAuthToken(data.token);
    },
    onError: (error) => {
      console.error("Login failed:", getErrorMessage(error));
    },
  });
};

/**
 * Custom hook for user logout
 *
 * Simply removes the token from localStorage
 *
 * @returns Logout function
 */
export const useLogout = () => {
  return () => {
    removeAuthToken();
    window.location.href = "/"; // Force reload to clear state
  };
};
