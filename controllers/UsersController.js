import { ObjectId } from 'mongodb';

const crypto = require('crypto');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

function hashPasswd(password) {
  const hashing = crypto.createHash('sha1');
  const data = hashing.update(password, 'utf-8');
  const genHash = data.digest('hex');
  return genHash;
}

class UsersController {
  static async postNew(request, rest) {
    const { email } = request.body;
    const { password } = request.body;
    const search = await dbClient.db.collection('users').find({ email }).toArray();
    if (!email) {
      return (rest.status(400).json({ error: 'Missing email' }));
    } if (!password) {
      return (rest.status(400).json({ error: 'Missing password' }));
    } if (search.length > 0) {
      return (rest.status(400).json({ error: 'Already exist' }));
    }
    const hashpwd = hashPasswd(password);
    const addUser = await dbClient.db.collection('users').insertOne({ email, password: hashpwd });
    const newUser = { id: addUser.ops[0]._id, email: addUser.ops[0].email };
    return (rest.status(201).json(newUser));
  }
  static async getMe(request, rest) {
    const key = request.header('X-Token');
    const session = await redisClient.get(`auth_${key}`);
    if (!key || key.length === 0) {
      return rest.status(401).json({ error: 'Unauthorized' });
    }
    if (session) {
      const search = await dbClient.db.collection('users').find({ _id: ObjectId(session) }).toArray();
      return (rest.status(200).json({ id: search[0]._id, email: search[0].email }));
    }
    return (rest.status(401).json({ error: 'Unauthorized' }));
  }
}

module.exports = UsersController;
