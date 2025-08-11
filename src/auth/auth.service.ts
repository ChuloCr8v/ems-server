import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { decode } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AzureAuthDto, IAuthUser } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) { }

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
        throw new InternalServerErrorException('Azure authentication not configured');
      }
      const decoded = decode(token, { complete: true });

      if (!decoded || typeof decoded.payload === 'string') {
        throw new UnauthorizedException('Invalid token');
      }

      const { iss, aud } = decoded.payload as any;
      if (iss !== this.graphParams.iss || aud !== this.graphParams.aud) {
        throw new UnauthorizedException('Invalid token issuer or audience');
      }
      const response = await axios
        .get(this.graphParams.endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => {
          throw new UnauthorizedException('Failed to fetch user info from Microsoft');
        });

      const email = response.data?.mail;
      if (!email) {
        throw new UnauthorizedException('Email not found in Microsoft account');
      }

      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          userRole: true,
          prospect: true
        },
      });

      if (!user) {
        throw new UnauthorizedException('User does not exist in the system');
      }

      const payload = { sub: user.id, email: user.email, role: user.userRole };
      return {
        access_token: this.jwt.sign(payload),
        user,
      };
    } catch (error) {
      throw new UnauthorizedException('Authentication failed: ' + error.message);
    }

  }

  async authUser(user: IAuthUser) {
    return this.prisma.user.findUnique({
      where: { id: user.sub },
      include: {
        // prospect: true,
        contacts: true,
        upload: true,
        level: true,
      },
    });
  }
}
