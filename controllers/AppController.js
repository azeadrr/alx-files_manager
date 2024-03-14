import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(request, rest) {
    const data = {
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    };
    rest.send(data);
  }
  static async getStats(request, rest) {
    const data = {
      users: await dbClient.nbUsers(),
      files: await dbClient.nbFiles(),
    };

    rest.send(data);
  }
}
module.exports = AppController;
