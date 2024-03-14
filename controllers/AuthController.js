import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const sha1 = require('sha1');
const uuid4 = require('uuid').v4;

class AuthController {
  static async getConnect(request, rest) {
    const [email, password] = Buffer.from(
      request.headers.authorization.split(' ')[1],
      'base64',
    )
      .toString('utf-8')
      .split(':');
    if (!email || !password) return rest.status(401).send({ error: 'Unauthorized' });

    const users = await dbClient.db.collection('users');
    const user = await users.findOne({ email, password: sha1(password) });

    if (!user) return rest.status(401).send({ error: 'Unauthorized' });

    const token = uuid4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 60 * 60 * 24);

    return rest.send({ token });
  }
  static async getDisconnect(request, rest) {
    const token = request.headers['x-token'];
    if (!token) return rest.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return rest.status(401).send({ error: 'Unauthorized' });

    await redisClient.del(`auth_${token}`);
    return rest.status(204).send();
  }
}
module.exports = AuthController;
