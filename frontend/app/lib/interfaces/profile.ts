/* eslint-disable camelcase */
export interface IUserProfile {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  fullName: string;
  password: boolean;
  latitude?: number;
  longitude?: number;
}

export interface IUserProfileUpdate {
  email?: string;
  fullName?: string;
  original?: string;
  password?: string;
  is_active?: boolean;
  is_superuser?: boolean;
  latitude?: number;
  longitude?: number;
  location?: string;
}

export interface IUserProfileCreate {
  email: string;
  fullName?: string;
  password?: string;
  is_active?: boolean;
  is_superuser?: boolean;
}

export interface IUserOpenProfileCreate {
  email: string;
  fullName?: string;
  password: string;
  latitude?: number;
  longitude?: number;
}
