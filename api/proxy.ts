import { handleProxyRequest, type ApiRequest, type ApiResponse } from '../lib/m3u8Server';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  await handleProxyRequest(req, res);
}
