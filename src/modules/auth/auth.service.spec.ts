import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository, UpdateResult } from 'typeorm';
import { AuthService } from './auth.service';
import { CryptoService } from '../../common/services/crypto.service';
import { User } from '../../database/entities/user.entity';
import { Challenge } from '../../database/entities/challenge.entity';
import { LoggerService } from '../../common/services/logger.service';
import { SecurityMetricsService } from '../../common/services/security-metrics.service';
import { formatCaip10 } from '../../common/utils/caip10.util';

describe('AuthService.verifySiweSignature', () => {
  const checksumAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const normalizedAddress = checksumAddress.toLowerCase();
  const nonce = 'nonce12345678';

  let service: AuthService;
  let crypto: { verifySiweSignature: jest.Mock } & Partial<CryptoService>;
  let jwt: { sign: jest.Mock } & Partial<JwtService>;
  let users: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock } & Partial<Repository<User>>;
  let challenges: { findOne: jest.Mock; update: jest.Mock; save: jest.Mock } & Partial<Repository<Challenge>>;
  let logger: { auditLog: jest.Mock; warn: jest.Mock } & Partial<LoggerService>;
  let metrics: {
    recordLoginSuccess: jest.Mock;
    recordLoginFailure: jest.Mock;
    recordLogout?: jest.Mock;
  } & Partial<SecurityMetricsService>;
  let message: string;
  let freshChallenge: Challenge;

  beforeEach(() => {
    crypto = { verifySiweSignature: jest.fn().mockResolvedValue(true) };
    jwt = { sign: jest.fn().mockReturnValue('token') };
    users = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    challenges = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
    };
    logger = {
      auditLog: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn(),
    };
    metrics = {
      recordLoginSuccess: jest.fn(),
      recordLoginFailure: jest.fn(),
    };

    service = new AuthService(
      jwt as unknown as JwtService,
      crypto as unknown as CryptoService,
      logger as unknown as LoggerService,
      metrics as unknown as SecurityMetricsService,
      users as unknown as Repository<User>,
      challenges as unknown as Repository<Challenge>,
    );

    const expiresAt = new Date(Date.now() + 60_000);
    message = (service as unknown as { buildSiweMessage: (...args: any[]) => string }).buildSiweMessage(
      checksumAddress,
      1,
      'Sign in',
      nonce,
      expiresAt,
    );

    freshChallenge = {
      id: '1',
      nonce,
      address: normalizedAddress,
      message,
      used: false,
      chainType: 'ethereum',
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Challenge;
  });

  describe('createSiweChallenge', () => {
    it('persists a challenge with normalized address and returns message', async () => {
      const saveSpy = challenges.save.mockImplementation(async (payload) => ({ id: 'challenge-1', ...payload }));

      const result = await service.createSiweChallenge('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 1, 'Welcome');

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nonce: expect.any(String),
          address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
          chainType: 'ethereum',
          used: false,
        }),
      );

      const savedChallenge = saveSpy.mock.calls[0][0];
      expect(new Date(savedChallenge.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(result).toEqual(
        expect.objectContaining({
          nonce: savedChallenge.nonce,
          message: savedChallenge.message,
          expiresAt: expect.any(String),
        }),
      );
    });

    it('rejects invalid wallet addresses', async () => {
      await expect(service.createSiweChallenge('not-an-address', 1, 'Hi')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(challenges.save).not.toHaveBeenCalled();
    });

    it('keeps non-default ports in the SIWE domain', async () => {
      challenges.save.mockImplementation(async (payload) => payload);

      const result = await service.createSiweChallenge(
        checksumAddress,
        56,
        'Welcome',
        'localhost:5173',
        'http://localhost:5173',
      );

      expect(result.message).toContain('localhost:5173 wants you to sign in with your Ethereum account');
      expect(result.message).toContain('URI: http://localhost:5173');
    });
  });

  it('throws when challenge not found', async () => {
    challenges.findOne.mockResolvedValue(null);

    await expect(service.verifySiweSignature(message, '0xsignature')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when challenge already used', async () => {
    challenges.findOne.mockResolvedValue({ ...freshChallenge, used: true });

    await expect(service.verifySiweSignature(message, '0xsignature')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when challenge expired', async () => {
    challenges.findOne.mockResolvedValue({ ...freshChallenge, expiresAt: new Date(Date.now() - 1000) });

    await expect(service.verifySiweSignature(message, '0xsignature')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when message mismatch', async () => {
    challenges.findOne.mockResolvedValue({ ...freshChallenge, message: `${message} extra` });

    await expect(service.verifySiweSignature(message, '0xsignature')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when chain mismatch', async () => {
    challenges.findOne.mockResolvedValue({ ...freshChallenge, chainType: 'polygon' });

    await expect(service.verifySiweSignature(message, '0xsignature')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('marks challenge used atomically and returns token', async () => {
    challenges.findOne.mockResolvedValue(freshChallenge);
    challenges.update.mockResolvedValue({ affected: 1 } as UpdateResult);
    users.findOne.mockResolvedValue({ id: 'user-1', walletAddress: normalizedAddress, chain: 'ethereum', isActive: true } as User);

    const result = await service.verifySiweSignature(message, '0xsignature', { ip: '127.0.0.1' });
    const expectedCaip = formatCaip10(1, normalizedAddress);

    expect(crypto.verifySiweSignature).toHaveBeenCalledWith(
      message,
      '0xsignature',
      normalizedAddress,
      1,
    );

    expect(challenges.update).toHaveBeenCalledWith({ id: '1', used: false }, { used: true });
    expect(result).toEqual(expect.objectContaining({ token: 'token', primaryWallet: normalizedAddress, primaryWalletCaip10: expectedCaip }));
    expect(logger.auditLog).toHaveBeenCalledWith(
      'auth.login.success',
      'user-1',
      expect.objectContaining({ method: 'siwe', wallet: normalizedAddress }),
    );
    expect(metrics.recordLoginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'siwe', wallet: expectedCaip, ip: '127.0.0.1' }),
    );
  });

  it('persists challenge chain type when creating a new SIWE user', async () => {
    const bscNonce = 'noncebsc12345';
    const bscExpiresAt = new Date(Date.now() + 120_000);
    const bscMessage = (service as unknown as { buildSiweMessage: (...args: any[]) => string }).buildSiweMessage(
      checksumAddress,
      56,
      'Sign in',
      bscNonce,
      bscExpiresAt,
    );

    const bscChallenge: Challenge = {
      ...freshChallenge,
      id: 'challenge-bsc',
      nonce: bscNonce,
      message: bscMessage,
      chainType: 'bsc',
      expiresAt: bscExpiresAt,
    };

    challenges.findOne.mockResolvedValue(bscChallenge);
    challenges.update.mockResolvedValue({ affected: 1 } as UpdateResult);
    users.findOne.mockResolvedValue(null);
    users.save.mockResolvedValue({
      id: 'user-bsc',
      walletAddress: normalizedAddress,
      chain: 'bsc',
      isActive: true,
    } as User);

    await service.verifySiweSignature(bscMessage, '0xsignature');
    const expectedCaip = formatCaip10(56, normalizedAddress);

    expect(crypto.verifySiweSignature).toHaveBeenCalledWith(
      bscMessage,
      '0xsignature',
      normalizedAddress,
      56,
    );

    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ chain: 'bsc', walletAddressCaip10: expectedCaip }));
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ chainType: 'bsc' }));
    expect(metrics.recordLoginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'siwe', wallet: expectedCaip, chainType: 'bsc' }),
    );
  });

  it('logs failures when signature verification fails', async () => {
    challenges.findOne.mockResolvedValue(freshChallenge);
    challenges.update.mockResolvedValue({ affected: 1 } as UpdateResult);
    crypto.verifySiweSignature.mockResolvedValue(false);

    await expect(service.verifySiweSignature(message, '0xsignature', { ip: '127.0.0.1' })).rejects.toBeInstanceOf(UnauthorizedException);
    const expectedCaip = formatCaip10(1, normalizedAddress);
    expect(logger.auditLog).toHaveBeenCalledWith(
      'auth.login.failure',
      'unknown',
      expect.objectContaining({ method: 'siwe', wallet: normalizedAddress }),
    );
    expect(metrics.recordLoginFailure).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'siwe', wallet: expectedCaip, ip: '127.0.0.1' }),
    );
  });
});

describe('AuthService.verifySolanaSignature', () => {
  const solanaPublicKey = '11111111111111111111111111111111';
  let service: AuthService;
  let crypto: { verifySolanaSignature: jest.Mock } & Partial<CryptoService>;
  let jwt: { sign: jest.Mock } & Partial<JwtService>;
  let users: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock } & Partial<Repository<User>>;
  let challengeRepository: {
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  } & Partial<Repository<Challenge>>;
  let storedChallenges: Map<string, Challenge>;
  let logger: { auditLog: jest.Mock; warn: jest.Mock } & Partial<LoggerService>;
  let metrics: {
    recordLoginSuccess: jest.Mock;
    recordLoginFailure: jest.Mock;
  } & Partial<SecurityMetricsService>;

  beforeEach(() => {
    storedChallenges = new Map<string, Challenge>();
    crypto = {
      verifySolanaSignature: jest.fn().mockResolvedValue(true),
      verifySiweSignature: jest.fn(),
    };
    jwt = { sign: jest.fn().mockReturnValue('token') };
    users = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    logger = {
      auditLog: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn(),
    };
    metrics = {
      recordLoginSuccess: jest.fn(),
      recordLoginFailure: jest.fn(),
    };
    challengeRepository = {
      save: jest.fn(async (challenge: Partial<Challenge>) => {
        const entity: Challenge = {
          id: challenge.id ?? `challenge-${storedChallenges.size + 1}`,
          nonce: challenge.nonce!,
          address: challenge.address!,
          chainType: challenge.chainType!,
          message: challenge.message!,
          expiresAt: challenge.expiresAt!,
          used: challenge.used ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        storedChallenges.set(entity.nonce, entity);
        return entity;
      }),
      findOne: jest.fn(async ({ where: { nonce } }: { where: { nonce: string } }) => storedChallenges.get(nonce) ?? null),
      update: jest.fn(async ({ id, used }: { id: string; used?: boolean }, data: Partial<Challenge>) => {
        const entry = [...storedChallenges.values()].find((challenge) => challenge.id === id && (used === undefined || challenge.used === used));
        if (!entry) {
          return { affected: 0 } as UpdateResult;
        }
        Object.assign(entry, data);
        storedChallenges.set(entry.nonce, entry);
        return { affected: 1 } as UpdateResult;
      }),
    } as any;

    service = new AuthService(
      jwt as unknown as JwtService,
      crypto as unknown as CryptoService,
      logger as unknown as LoggerService,
      metrics as unknown as SecurityMetricsService,
      users as unknown as Repository<User>,
      challengeRepository as unknown as Repository<Challenge>,
    );
  });

  it('verifies Solana signature and marks challenge as used', async () => {
    const { message, nonce } = await service.createSolanaChallenge(solanaPublicKey, 'Sign in to Solana');
    users.findOne.mockResolvedValue({ id: 'user-1', walletAddress: solanaPublicKey, chain: 'solana', isActive: true } as User);

    const result = await service.verifySolanaSignature(message, 'base64signature', solanaPublicKey, { ip: '127.0.0.2' });

    expect(crypto.verifySolanaSignature).toHaveBeenCalledWith(message, 'base64signature', solanaPublicKey);
    const expectedCaip = `caip10:solana:mainnet:${solanaPublicKey}`;
    expect(result).toEqual(expect.objectContaining({ token: 'token', primaryWallet: solanaPublicKey, primaryWalletCaip10: expectedCaip }));
    expect(storedChallenges.get(nonce)?.used).toBe(true);
    expect(logger.auditLog).toHaveBeenCalledWith(
      'auth.login.success',
      'user-1',
      expect.objectContaining({ method: 'solana', wallet: solanaPublicKey }),
    );
    expect(metrics.recordLoginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'solana', wallet: expectedCaip, ip: '127.0.0.2' }),
    );
  });

  it('throws when Solana signature is invalid', async () => {
    const { message } = await service.createSolanaChallenge(solanaPublicKey, 'Sign in to Solana');
    crypto.verifySolanaSignature.mockResolvedValue(false);

    await expect(
      service.verifySolanaSignature(message, 'invalid', solanaPublicKey, { ip: '127.0.0.2' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const expectedCaip = `caip10:solana:mainnet:${solanaPublicKey}`;
    expect(logger.auditLog).toHaveBeenCalledWith(
      'auth.login.failure',
      'unknown',
      expect.objectContaining({ method: 'solana', wallet: solanaPublicKey }),
    );
    expect(metrics.recordLoginFailure).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'solana', wallet: expectedCaip, ip: '127.0.0.2' }),
    );
  });

  it('throws when Solana challenge is missing', async () => {
    const { message } = await service.createSolanaChallenge(solanaPublicKey, 'Sign in to Solana');
    storedChallenges.clear();

    await expect(
      service.verifySolanaSignature(message, 'sig', solanaPublicKey),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
