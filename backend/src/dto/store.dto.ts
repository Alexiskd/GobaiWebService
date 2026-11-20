// Décorateurs de documentation OpenAPI.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// Validateurs des champs reçus.
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
// Conversion des paramètres reçus.
import { Type } from 'class-transformer';
// Borne de la location à l'heure.
import { MAX_ORBIT_HOURS } from '../services/store/catalogue';

/** Un article du catalogue. */
export class ProductDto {
  @ApiProperty({ example: 'body-mars' }) id: string;
  @ApiProperty({ example: 'Export de Mars' }) label: string;
  @ApiProperty({ example: 'Modèle 3D complet de Mars et ses tuiles assemblées en une seule image.' }) description: string;
  @ApiProperty({ example: 49900, description: 'Prix en centimes.' }) cents: number;
  @ApiProperty({ example: '499,00 €', description: 'Prix mis en forme.' }) price: string;
  @ApiProperty({ example: ['body:mars'], description: 'Droits accordés par l’achat.' }) scopes: string[];
  @ApiPropertyOptional({ example: true, description: 'Vrai quand le prix est horaire : le montant suit le nombre d’heures achetées.' }) hourly?: boolean;
  @ApiPropertyOptional({ example: true, description: 'Vrai quand l’article comprend un fond de carte assemblé ; faux pour un astre qui n’a pas de tuiles (le Soleil, par exemple).' }) tiled?: boolean;
}

/** Le catalogue et l'état du paiement. */
export class CatalogueDto {
  @ApiProperty({ example: true, description: 'Faux quand Stripe ou la clé de signature ne sont pas configurés.' }) enabled: boolean;
  @ApiProperty({ example: 'test', enum: ['test', 'production'] }) environment: string;
  @ApiProperty({ example: 'eur' }) currency: string;
  @ApiProperty({ example: 365, description: 'Durée de validité du jeton d’accès, en jours.' }) licenceDays: number;
  @ApiProperty({ type: [ProductDto] }) products: ProductDto[];
  @ApiProperty({ example: ['https://www.gobaispace.com'], description: 'Sites vers lesquels l’acheteur peut revenir.' }) sites: string[];
  @ApiProperty({ example: [], description: 'Variables d’environnement manquantes qui empêchent le paiement de s’ouvrir. Vide quand tout est configuré.' }) missing: string[];
  @ApiProperty({ example: true, description: 'Vrai quand les achats sont enregistrés en base et survivent à un redémarrage.' }) persistent: boolean;
}

/** Corps de POST /store/orders. */
export class CreateOrderDto {
  @ApiProperty({ example: 'body-mars', description: 'Identifiant de l’article du catalogue.' })
  @IsString() @MaxLength(60) @Matches(/^[a-z0-9-]+$/, { message: 'Identifiant d’article inattendu.' })
  productId: string;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: MAX_ORBIT_HOURS, description: 'Nombre d’heures, pour un article loué à l’heure. Ignoré par les articles à prix fixe.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_ORBIT_HOURS)
  hours?: number;
}

/** Page de paiement créée. */
export class OrderDto {
  @ApiProperty({ example: 'cs_test_a1…', description: 'Identifiant de la session de paiement, à présenter pour réclamer l’accès.' }) id: string;
  @ApiProperty({ example: 'https://checkout.stripe.com/c/pay/cs_test_a1…', description: 'Page de paiement Stripe.' }) url: string;
  @ApiProperty({ type: ProductDto }) product: ProductDto;
  @ApiProperty({ example: 3, description: 'Nombre d’heures payées (1 pour un article à prix fixe).' }) hours: number;
  @ApiProperty({ example: 300000, description: 'Montant à payer, en centimes.' }) cents: number;
}

/** Paramètre de route : l'identifiant d'une session de paiement. */
export class OrderParamsDto {
  @ApiProperty({ example: 'cs_test_a1…' })
  @IsString() @MaxLength(200) @Matches(/^cs_[A-Za-z0-9_]+$/, { message: 'Identifiant de session de paiement inattendu.' })
  id: string;
}

/** L'accès délivré après paiement. */
export class LicenceDto {
  @ApiProperty({ description: 'Jeton JWT à présenter dans l’en-tête « Authorization: Bearer ». À garder : il n’est pas stocké sur le serveur.' }) token: string;
  @ApiProperty({ example: ['orbit:mars'] }) scopes: string[];
  @ApiProperty({ example: 3, description: 'Heures payées ; le jeton expire au bout de ce délai pour une location.' }) hours: number;
  @ApiProperty({ example: '2026-11-14T10:00:00.000Z' }) expiresAt: string;
  @ApiPropertyOptional({ description: 'Article acheté.' }) product: { id: string; label: string; price: string };
  @ApiPropertyOptional({ description: 'Compte acheteur.' }) buyer?: { id: string; name: string };
  @ApiPropertyOptional({ example: 'cs_test_a1…', description: 'Session de paiement Stripe correspondante.' }) payment?: string;
}

/** Les achats d'un compte connecté. */
export class LicencesDto {
  @ApiProperty({ type: [LicenceDto], description: 'Les achats encore valables, du plus récent au plus ancien, chacun avec un jeton frais.' }) items: LicenceDto[];
  @ApiProperty({ example: true, description: 'Vrai quand les achats sont enregistrés en base et survivent à un redémarrage.' }) persistent: boolean;
}
