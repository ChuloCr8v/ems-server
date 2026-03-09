import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { decode } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AzureAuthDto, IAuthUser } from './dto/auth.dto';
import { bad, mustHave } from 'src/utils/error.utils';
import { normalizeEmail } from 'src/utils/normalizeEmail.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get graphParams() {
    const azureClientId = this.config.get<string>('AZURE_CLIENT_ID');
    return {
      endpoint: 'https://graph.microsoft.com/v1.0/me',
      iss: `https://sts.windows.net/${azureClientId}/`,
      aud: '00000003-0000-0000-c000-000000000000',
    };
  }

  async azureLogin({ token }: AzureAuthDto) {
    try {
      const azureClientId = this.config.get<string>('AZURE_CLIENT_ID');
      if (!azureClientId) {
        throw new InternalServerErrorException(
          'Azure authentication not configured',
        );
      }
      const decoded = decode(token, { complete: true });

      if (!decoded || typeof decoded.payload === 'string') {
        bad('Invalid token');
      }

      const { iss, aud } = decoded.payload;
      if (iss !== this.graphParams.iss || aud !== this.graphParams.aud) {
        bad('Invalid token issuer or audience');
      }
      const response = await axios
        .get(this.graphParams.endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => {
          bad('Failed to fetch user info from Microsoft');
        });

      const email = normalizeEmail(response.data?.mail);

      if (!email) {
        bad('Email not found in Microsoft account');
      }

      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          userRole: true,
          prospect: true,
          status: true,
        },
      });

      if (!user) {
        bad('User does not exist in the system');
      }

      if (user.status === 'INACTIVE')
        bad('Your account has been deactivated. Contact your admin.');

      const payload = { sub: user.id, email: user.email, role: user.userRole };
      return {
        access_token: this.jwt.sign(payload),
        user,
      };
    } catch (error) {
      bad('Authentication failed: ' + error.message);
    }
  }

  // Generate accesstoken for prospect for documents upload

  async generateProspectAccessToken(userId: string) {
    if (!userId) bad('User id is required');

    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) mustHave(user, 'User not found', 404);
      const payload = { sub: user.id, email: user.email, role: user.userRole };
      return {
        access_token: this.jwt.sign(payload),
        user,
      };
    } catch (error) {
      console.log(error);
      bad(error);
    }
  }

  async emailLogin(email: string, password: string) {
    const isDev = process.env.IS_DEV === 'true';
    // if (!isDev) bad("Login with your Microsoft account");

    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: email,
        },
      });

      if (!user) mustHave(user, 'User not found', 404);

      if (user.email !== password) bad('Incorrect Password');
      if (user.status === 'INACTIVE')
        bad('Your account has been deactivated. Contact your admin.');

      const payload = { sub: user.id, email: user.email, role: user.userRole };
      return {
        access_token: this.jwt.sign(payload),
        user,
      };
    } catch (error) {
      console.log(error);
      bad(error);
    }
  }

  async authUser(user: IAuthUser) {
    return this.prisma.user.findUnique({
      where: { id: user.sub },
      include: {
        // prospect: true,
        contacts: true,
        userDocuments: true,
        level: true,
      },
    });
  }
}
