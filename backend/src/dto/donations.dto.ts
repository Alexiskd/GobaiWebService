import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, Matches, Max, Min } from 'class-validator';

export class DonationStatusDto {
  @ApiProperty({ example: true, description: 'Vrai si PayPal est configuré sur le serveur.' }) enabled!: boolean;
  @ApiProperty({ nullable: true, type: String, description: 'Identifiant client PayPal public (pour charger les boutons).' }) clientId!: string | null;
  @ApiProperty({ enum: ['sandbox', 'production'] }) environment!: 'sandbox' | 'production';
  @ApiProperty({ example: 'EUR' }) currency!: string;
  @ApiProperty({ example: '2026-11', description: 'Mois civil en cours (fuseau du serveur de dons).' }) month!: string;
  @ApiProperty({ example: '2026-11-30T23:00:00.000Z', description: 'Remise à zéro du plafond (1er du mois suivant, 00:00).' }) resetsAt!: string;
  @ApiProperty({ example: 'Europe/Paris', description: 'Fuseau du mois civil.' }) timeZone!: string;
  @ApiProperty({ example: 3400 }) monthlyLimit!: number;
  @ApiProperty({ example: 120, description: 'Montant encaissé ce mois-ci.' }) raised!: number;
  @ApiProperty({ example: 3280, description: 'Montant encore acceptable ce mois-ci (réservations comprises).' }) remaining!: number;
  @ApiProperty({ example: 1 }) minAmount!: number;
}

export class CreateDonationDto {
  @ApiProperty({ example: 10, description: 'Montant du don en euros (2 décimales au plus).' })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(100000)
  amount!: number;
}

export class DonationOrderDto {
  @ApiProperty({ example: '5O190127TN364715T', description: 'Identifiant de la commande PayPal.' }) id!: string;
}

export class DonationOrderParamsDto {
  @IsString() @Matches(/^[A-Z0-9]{8,40}$/) id!: string;
}

export class DonationCaptureDto {
  @ApiProperty({ example: 'COMPLETED' }) status!: string;
  @ApiProperty({ example: 10 }) amount!: number;
  @ApiProperty({ example: 130 }) raised!: number;
  @ApiProperty({ example: 3270 }) remaining!: number;
}
