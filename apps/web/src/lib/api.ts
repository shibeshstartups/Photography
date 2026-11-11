import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("device_id");
      delete api.defaults.headers.common["Authorization"];
      delete api.defaults.headers.common["X-Device-ID"];
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;