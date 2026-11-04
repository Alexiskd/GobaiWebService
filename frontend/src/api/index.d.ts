export function resolveApiUrl(path: string): string;

export function fetchContributionP2PConfig(signal?: AbortSignal): Promise<{
  maxPeers: number;
  iceServers: RTCIceServer[];
  signalPath: string;
}>;
