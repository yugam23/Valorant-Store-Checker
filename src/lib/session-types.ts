export interface SessionData {
  accessToken: string;
  idToken?: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
  gameName?: string;
  tagLine?: string;
  country?: string;
  riotCookies?: string;
  createdAt: number;
  [key: string]: string | number | undefined;
}
