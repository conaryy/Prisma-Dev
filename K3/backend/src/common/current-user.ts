export type CurrentUser = {
  sub: string;
  email?: string;
  username?: string;
  name?: string;
  roles: string[];
};
