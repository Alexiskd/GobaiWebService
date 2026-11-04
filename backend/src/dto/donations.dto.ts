import { ApiProperty } from '@nestjs/swagger';

export class DonationConfigDto {
  @ApiProperty({ example: true, description: 'Indique si un lien de don est configuré.' })
  enabled!: boolean;

  @ApiProperty({
    example: 'production',
    enum: ['sandbox', 'production'],
    description: 'Environnement du Donate SDK PayPal.',
  })
  environment!: 'sandbox' | 'production';

  @ApiProperty({ required: false, example: 'EXAMPLE123', description: 'Identifiant public du bouton PayPal hébergé.' })
  hostedButtonId?: string;

  @ApiProperty({ required: false, example: 'creator@example.com', description: 'Adresse e-mail ou identifiant public du compte PayPal.' })
  business?: string;
}
