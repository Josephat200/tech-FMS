export type User = {
  id: string;
  email: string;
  passwordHash: string;
  roles: string[];
  isActive: boolean;
};
