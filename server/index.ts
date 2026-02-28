import { createRelayServer } from './relay';

// Render sets PORT env var. Default to 9001 for local dev.
const PORT = parseInt(process.env.PORT ?? '9001', 10);
createRelayServer(PORT);
