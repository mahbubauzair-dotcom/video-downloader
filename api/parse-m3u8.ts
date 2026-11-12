import { handleParseM3U8Request, type ApiRequest, type ApiResponse } from '../lib/m3u8Server';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  await handleParseM3U8Request(req, res);
}
