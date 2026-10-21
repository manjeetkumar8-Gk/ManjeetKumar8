import { Request } from "express";

export interface AuthUser {
  id: number;
  shop_id: number | null;
  role_id: number;
  role_name: string;
  username: string;
  name: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}