import axios, { AxiosError } from "axios";

/**
 * API base URL - should be environment variable in production
 */
export const API_BASE_URL = "http://localhost:5000";

/**
 * Get auth token from localStorage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem("token");
};

/**
 * Set auth token in localStorage
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem("token", token);
};

/**
 * Remove auth token from localStorage
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem("token");
};

/**
 * Create axios instance with auth headers
 */
export const createApiClient = () => {
  const token = getAuthToken();

  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
};

/**
 * Default API client (without auth)
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Type guard for Axios errors
 */
export const isAxiosError = (error: unknown): error is AxiosError => {
  return axios.isAxiosError(error);
};

/**
 * Extract error message from API error
 */
export const getErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    return (
      error.response?.data?.message || error.message || "An error occurred"
    );
  }
  return "An unexpected error occurred";
};

/**
 * Check if error is authentication error (401)
 */
export const isAuthError = (error: unknown): boolean => {
  return isAxiosError(error) && error.response?.status === 401;
};

/**
 * Check if error is conflict error (409)
 */
export const isConflictError = (error: unknown): boolean => {
  return isAxiosError(error) && error.response?.status === 409;
};
