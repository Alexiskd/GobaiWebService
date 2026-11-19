import { Controller, Get, Headers, Query, UnauthorizedException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-error.dto';
import { accessSecret, JWT_AUDIENCE, JWT_ISSUER } from '../common/jwt.guard';
import { JwtError, bearerToken, verifyJwt } from '../common/jwt';
import { scopeAllows } from '../services/store/catalogue';

class VerifyAccessDto { valid: boolean; scopes: string[]; expiresAt: string | null; }

/** Vérifie le JWT et le droit demandé avec la même fonction cryptographique que les routes payantes. */
@ApiTags('Exports')
@Controller('export')
export class ExportAccessController {
  @Get('access')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiBearerAuth('cle-api')
  @ApiOperation({ summary: 'Vérifier une clé et ses droits d’export', description: 'Vérifie la signature HS256, exp, nbf, issuer, audience et, si scope est fourni, le droit demandé. Ne renvoie jamais le jeton.' })
  @ApiOkResponse({ type: VerifyAccessDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Jeton absent, invalide ou expiré.' })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Jeton valide mais droit demandé absent.' })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto, description: 'Secret de signature indisponible.' })
  verify(@Headers('authorization') authorization?: string, @Query('scope') scope?: string) {
    const secret = accessSecret();
    if (!secret) throw new ServiceUnavailableException('La vérification des accès payants est indisponible : secret serveur absent.');
    const token = bearerToken(authorization);
    if (!token) throw new UnauthorizedException('Jeton absent : fournissez Authorization: Bearer <jeton>.');
    let claims;
    try { claims = verifyJwt(token, secret, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE }); }
    catch (error) { if (error instanceof JwtError) throw new UnauthorizedException(error.message); throw error; }
    const scopes = Array.isArray(claims.scope) ? claims.scope.filter((value): value is string => typeof value === 'string') : [];
    if (scope && !scopeAllows(scopes, scope)) throw new ForbiddenException('Le jeton est valide, mais ne possède pas le droit demandé.');
    return { valid: true, scopes, expiresAt: typeof claims.exp === 'number' ? new Date(claims.exp * 1000).toISOString() : null };
  }
}