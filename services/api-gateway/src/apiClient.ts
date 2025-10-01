import axios from "axios";
import axiosRetry from "axios-retry";

// Create a new axios instance for our internal API calls
const apiClient = axios.create();

// Apply the retry middleware
axiosRetry(apiClient, {
  retries: 3, // try 3 times
  retryDelay: (retryCount) => {
    console.log(`Retry attempt #${retryCount}. Waiting...`);
    return retryCount * 200; // 200ms, 400ms, 600ms
  },
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response?.status ?? 0) >= 500
    );
  },
});

export default apiClient;
