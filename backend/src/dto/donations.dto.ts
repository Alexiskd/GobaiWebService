// Importe ApiProperty, la description d'un champ pour Swagger.
import { ApiProperty } from '@nestjs/swagger';
// Importe Type, la conversion de type à la réception.
import { Type } from 'class-transformer';
// Importe les règles de validation : nombre, texte, motif, maximum et minimum.
import { IsNumber, IsString, Matches, Max, Min } from 'class-validator';

// Déclare et exporte DonationStatusDto, l'état des dons (début).
export class DonationStatusDto {
  // enabled : vrai si Stripe est configuré.
  @ApiProperty({ example: true, description: 'Vrai si Stripe est configuré sur le serveur.' }) enabled!: boolean;
  // environment : test ou production.
  @ApiProperty({ enum: ['test', 'production'], description: 'Mode test de Stripe ou vrais paiements.' }) environment!: 'test' | 'production';
  // currency : la devise.
  @ApiProperty({ example: 'EUR' }) currency!: string;
  // minAmount : le montant minimal.
  @ApiProperty({ example: 1 }) minAmount!: number;
// Fin de DonationStatusDto.
}

// Déclare et exporte CreateDonationDto, la demande de don (début).
export class CreateDonationDto {
  // Description du montant.
  @ApiProperty({ example: 10, description: 'Montant du don en euros (2 décimales au plus).' })
  // Converti en nombre, 2 décimales au plus, entre 1 et 100 000.
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(100000)
  // amount : le montant en euros.
  amount!: number;
// Fin de CreateDonationDto.
}

// Déclare et exporte DonationOrderDto, le don créé (début).
export class DonationOrderDto {
  // id : l'identifiant de la session Stripe.
  @ApiProperty({ example: 'cs_test_a1B2c3D4e5F6', description: 'Identifiant de la session de paiement Stripe.' }) id!: string;
  // url : l'adresse de la page de paiement.
  @ApiProperty({ example: 'https://checkout.stripe.com/c/pay/cs_test_a1B2c3D4e5F6', description: 'Page de paiement Stripe vers laquelle rediriger le donateur.' }) url!: string;
// Fin de DonationOrderDto.
}

// Déclare et exporte DonationCancelDto, le don abandonné (début).
export class DonationCancelDto {
  // status : « CANCELLED » ou « COMPLETED ».
  @ApiProperty({ enum: ['CANCELLED', 'COMPLETED'], description: 'COMPLETED si le paiement avait finalement abouti.' }) status!: string;
// Fin de DonationCancelDto.
}

// Déclare et exporte DonationOrderParamsDto, le paramètre de la route (début).
export class DonationOrderParamsDto {
  // id : un texte de la forme d'un identifiant de session Stripe.
  @IsString() @Matches(/^cs_(test|live)_[A-Za-z0-9]{8,250}$/) id!: string;
// Fin de DonationOrderParamsDto.
}

// Déclare et exporte DonationCaptureDto, le don confirmé (début).
export class DonationCaptureDto {
  // status : l'état.
  @ApiProperty({ example: 'COMPLETED' }) status!: string;
  // amount : le montant.
  @ApiProperty({ example: 10 }) amount!: number;
// Fin de DonationCaptureDto.
}
