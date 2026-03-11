export interface User {
  id: string;
  name: string;
  email: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User | null;
}

export interface SignupResponse {
  success: boolean;
  message: string;
}
