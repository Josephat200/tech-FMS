import { Request, Response } from 'express';
import { env } from '../../../../config/env';
import { LoginUseCase } from '../../application/use-cases/LoginUseCase';
import { RegisterUseCase } from '../../application/use-cases/RegisterUseCase';
import { RefreshTokenUseCase } from '../../application/use-cases/RefreshTokenUseCase';
import { LogoutUseCase } from '../../application/use-cases/LogoutUseCase';
import { AdminProvisionUserUseCase } from '../../application/use-cases/AdminProvisionUserUseCase';
import { AppError } from '../../../../common/errors/AppError';
import { MfaService } from '../../application/services/MfaService';

export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly adminProvisionUserUseCase: AdminProvisionUserUseCase,
    private readonly mfaService: MfaService,
  ) {}

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
      path: `${env.API_PREFIX}/auth`,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: `${env.API_PREFIX}/auth`,
    });
  }

  private getRefreshToken(req: Request): string {
    const cookieToken = req.cookies?.refreshToken as string | undefined;
    const bodyToken = (req.body as { refreshToken?: string }).refreshToken;
    const refreshToken = cookieToken ?? bodyToken;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    return refreshToken;
  }

  register = async (req: Request, res: Response): Promise<void> => {
    const { username, email, password, firstName, lastName } = req.body as {
      username: string;
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    };

    const result = await this.registerUseCase.execute({
      username,
      email,
      password,
      firstName,
      lastName,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email: string; password: string };

    const result = await this.loginUseCase.execute({ email, password });
    this.setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken: result.accessToken, requiresMfa: false },
    });
  };

  verifyMfa = async (req: Request, res: Response): Promise<void> => {
    const { challengeId, code } = req.body as { challengeId: string; code: string };
    const userId = await this.mfaService.verifyLoginChallenge({ challengeId, code });
    const result = await this.loginUseCase.issueTokensForUserId(userId);
    this.setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken: result.accessToken, requiresMfa: false },
    });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = this.getRefreshToken(req);
    const result = await this.refreshTokenUseCase.execute({ refreshToken });
    this.setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken: result.accessToken },
    });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = this.getRefreshToken(req);
    await this.logoutUseCase.execute({ refreshToken });
    this.clearRefreshTokenCookie(res);

    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  };

  adminCreateUser = async (req: Request, res: Response): Promise<void> => {
    const { username, email, firstName, lastName, role } = req.body as {
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      role: 'ADMIN' | 'ACCOUNTANT' | 'FINANCE_MANAGER' | 'HR' | 'AUDITOR' | 'DEPARTMENT_MANAGER' | 'USER';
    };

    const result = await this.adminProvisionUserUseCase.execute({
      username,
      email,
      firstName,
      lastName,
      role,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  };
}
