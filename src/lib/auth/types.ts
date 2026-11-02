import type { Role } from "./constants";

export type CreatorProfile = {
  creatorId: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  city: string | null;
  state: string | null;
};

export type BrandProfile = {
  brandId: number;
  brandName: string;
  industry: string | null;
  contactNumber: string | null;
  city: string | null;
  state: string | null;
};

export type AuthUser = {
  userId: number;
  username: string;
  email: string;
  role: Role;
  createdAt: string;
  creatorProfile: CreatorProfile | null;
  brandProfile: BrandProfile | null;
};

export type SessionUser = {
  userId: number;
  username: string;
  role: Role;
  expiresAt: number;
};

export type LoginUser = {
  userId: number;
  username: string;
  email: string;
  role: Role;
  passwordHash: string;
};
