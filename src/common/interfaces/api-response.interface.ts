export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code?: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    path: string;
    version: string;
  };
}