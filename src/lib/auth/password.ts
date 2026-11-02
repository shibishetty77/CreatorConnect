import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export const DUMMY_PASSWORD_HASH =
  "$2b$12$GIoqqhV.eu2eWqwnQfEOTu0eh33Wi/pscfoAkkuFBlcpna72ACca2";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}
