import { describeTasksContract } from './tasksContract.js';
import { createServer } from './httpServer.js';

describeTasksContract('P2 · servidor node:http', createServer);
