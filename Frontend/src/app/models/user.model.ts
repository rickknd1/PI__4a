export interface User {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;           // ← Pour compatibilité
  email: string;
  phoneNumber?: string;
  password?: string;
  role: string;
  clubId: string;
  clubName?: string;
  profilePhoto?: string;
  active?: boolean;
}

// Pour compatibilité avec votre code existant
export interface LegacyUser {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  clubId: string;
  clubName?: string;
  active?: boolean;
}