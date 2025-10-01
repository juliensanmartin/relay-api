import CircuitBreaker from "opossum";
import apiClient from "./apiClient";

// These options mean: if 50% of requests in a 10-second window fail,
// open the circuit. After 15 seconds, try again.
const options: CircuitBreaker.Options = {
  timeout: 3000, // If the request takes longer than 3 seconds, trigger a failure
  errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
  resetTimeout: 15000, // After 15 seconds, try again.
};

// This is the function that the circuit breaker will wrap
// It's our original axios call to the post-service
const protectedRequest = async (config: any) => {
  return apiClient(config);
};

const postServiceBreaker = new CircuitBreaker(protectedRequest, options);

// You can add listeners to react to the state changes
postServiceBreaker.on("open", () =>
  console.log("CIRCUIT OPENED: The Post Service is down.")
);
postServiceBreaker.on("close", () =>
  console.log("CIRCUIT CLOSED: The Post Service is back up.")
);
postServiceBreaker.on("fallback", () =>
  console.log("CIRCUIT FALLBACK: Returning fallback response.")
);

export default postServiceBreaker;
