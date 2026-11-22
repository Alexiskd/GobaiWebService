// Tests des tuiles KTX2 de la Terre : vérification des coordonnées et service sans base (sans DATABASE_URL).
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EARTH_KTX2_MAX_ZOOM, EarthKtx2Service, checkEarthKtx2 } from './earth-ktx2.service';

describe('tuiles KTX2 de la Terre', () => {
  // Test : une tuile valide passe telle quelle.
  it('accepte une tuile de la grille', () => {
    expect(checkEarthKtx2('gibs', 3, 7, 0)).toEqual({ layer: 'gibs', z: 3, x: 7, y: 0 });
    expect(checkEarthKtx2('sentinel2', EARTH_KTX2_MAX_ZOOM, 63, 63).z).toBe(6);
  });

  // Test : couche inconnue, niveau trop fin, tuile hors grille, valeurs non entières.
  it('refuse une couche inconnue, un niveau au-delà de 6 et une tuile hors de la grille', () => {
    expect(() => checkEarthKtx2('google', 1, 0, 0)).toThrow(BadRequestException);
    expect(() => checkEarthKtx2('gibs', 7, 0, 0)).toThrow(BadRequestException);
    expect(() => checkEarthKtx2('gibs', -1, 0, 0)).toThrow(BadRequestException);
    expect(() => checkEarthKtx2('gibs', 2, 4, 0)).toThrow(BadRequestException);
    expect(() => checkEarthKtx2('gibs', 2, 0, -1)).toThrow(BadRequestException);
    expect(() => checkEarthKtx2('gibs', 2, 1.5, 0)).toThrow(BadRequestException);
    expect(() => checkEarthKtx2('gibs', 2, NaN, 0)).toThrow(BadRequestException);
  });

  // Test : sans base BP, le statut est vide et la tuile répond 404 (l'app prend le JPEG).
  it('sans BP : statut vide et tuile introuvable', async () => {
    const service = new EarthKtx2Service(undefined);
    await expect(service.status()).resolves.toEqual({ database: false, total: 0, bytes: 0, layers: {} });
    await expect(service.tile('gibs', 0, 0, 0)).rejects.toThrow(NotFoundException);
  });
});
