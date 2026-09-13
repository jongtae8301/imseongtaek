import { createServer } from 'vite';

/** 같은 프로세스에서 열고 닫아 Windows 셸의 자식 서버가 남지 않게 한다. */
export default async function setup() {
  const server = await createServer({
    server: { host: '127.0.0.1', port: 4174, strictPort: true },
  });
  await server.listen();
  return async () => {
    await server.close();
  };
}
