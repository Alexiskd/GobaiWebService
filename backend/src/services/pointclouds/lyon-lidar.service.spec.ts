import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { LyonLidarService } from './lyon-lidar.service';

describe('LyonLidarService', () => {
  const service = new LyonLidarService();
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes the Lyon dataset metadata and the streamed EPT endpoint', () => {
    expect(service.getMetadata()).toMatchObject({
      eptUrl: '/api/v1/pointclouds/lyon/ept/ept.json',
      pointCount: '13791199599',
      coordinateSystem: 'EPSG:3946 — RGF93 / CC46',
      license: 'Licence Ouverte / Open Licence 2.0 (LOv2)',
    });
  });

  it('fetches an allowed EPT node and forwards a valid byte range', async () => {
    fetchMock.mockResolvedValue(new Response('node'));

    await service.getAsset('ept-data/0-0-0-0.laz', 'bytes=0-99');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://download.data.grandlyon.com/files/grandlyon/imagerie/mnt2018/lidar/ept/ept-data/0-0-0-0.laz',
      expect.objectContaining({ headers: { Range: 'bytes=0-99' } }),
    );
  });

  it.each(['../secret', 'ept-data/../../secret.laz', 'https://example.com/data.laz', 'ept-data/node.bin'])(
    'rejects a disallowed EPT path: %s',
    async (path) => {
      await expect(service.getAsset(path)).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid Range headers and reports upstream failures', async () => {
    await expect(service.getAsset('ept.json', 'bytes=0-1,4-5')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getAsset('ept.json', 'bytes=8-2')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getAsset('ept.json', 'bytes=-0')).rejects.toBeInstanceOf(BadRequestException);
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(service.getAsset('ept.json')).rejects.toBeInstanceOf(NotFoundException);
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(service.getAsset('ept.json')).rejects.toBeInstanceOf(BadGatewayException);
  });
});
