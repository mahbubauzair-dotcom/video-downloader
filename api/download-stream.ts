import { handleDownloadStreamRequest, type ApiRequest, type ApiResponse } from '../lib/m3u8Server';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  await handleDownloadStreamRequest(req, res);
}
