import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id hashing with OWASP-recommended parameters (19 MiB memory, 2 iterations, 1 lane).
 */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  /** Pre-computed hash used to equalise timing when the user does not exist. */
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** Performs a verification against a throwaway hash so unknown emails take the same time. */
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-equalisation-1');
    await this.verify(await this.dummyHash, password);
  }
}
