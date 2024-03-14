import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const { ObjectId } = require('mongodb');
const uuid4 = require('uuid').v4;
const fs = require('fs');

const rootDir = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(request, rest) {
    const files = await dbClient.db.collection('files');

    const token = request.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return rest.status(401).send({ error: 'Unauthorized' });

    const users = await dbClient.db.collection('users');
    const user = await users.findOne({ _id: ObjectId(userId) });
    if (!user) return rest.status(401).send({ error: 'Unauthorized' });

    const data = { ...request.body };
    if (!data.name) return rest.status(400).send({ error: 'Missing name' });
    if (!data.type) return rest.status(400).send({ error: 'Missing type' });
    if (!['folder', 'file', 'image'].includes(data.type)) {
      return rest.status(400).send({ error: 'Missing type' });
    }
    if (data.type !== 'folder' && !data.data) {
      return rest.status(400).send({ error: 'Missing data' });
    }
    if (data.parentId) {
      const queryResult = await files.findOne({ _id: ObjectId(data.parentId) });
      if (!queryResult) {
        return rest.status(400).send({ error: 'Parent not found' });
      }
      if (queryResult.type !== 'folder') {
        return rest.status(400).send({ error: 'Parent is not a folder' });
      }
    }

    if (data.type !== 'folder') {
      const fileUuid = uuid4();
      data.localPath = fileUuid;
      const content = Buffer.from(data.data, 'base64');
      fs.mkdir(rootDir, { recursive: true }, (error) => {
        if (error) {
          console.log(error);
        }
        fs.writeFile(`${rootDir}/${fileUuid}`, content, (error) => {
          if (error) {
            console.log(error);
          }
          return true;
        });
        return true;
      });
    }

    data.userId = userId;
    data.parentId = data.parentId || 0;
    data.isPublic = data.isPublic || false;
    delete data.data;
    const queryResult = await files.insertOne(data);
    const objFromQuery = { ...queryResult.ops[0] };
    delete objFromQuery.localPath;
    return rest
      .status(201)
      .send({ ...objFromQuery, id: queryResult.insertedId });
  }
  static async getShow(request, rest) {
    const token = request.headers['x-token'];
    if (!token) return rest.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return rest.status(401).send({ error: 'Unauthorized' });

    const users = await dbClient.db.collection('users');
    const user = await users.findOne({ _id: ObjectId(userId) });
    if (!user) return rest.status(401).send({ error: 'Unauthorized' });

    const fileId = request.params.id;
    if (!fileId) return rest.status(404).send({ error: 'Not found' });
    const files = await dbClient.db.collection('files');
    const file = await files.findOne({ _id: ObjectId(fileId), userId });
    if (!file) return rest.status(404).send({ error: 'Not found' });

    delete file.localPath;
    file.id = file._id;
    delete file._id;
    return rest.send(file);
  }
  static async getIndex(request, rest) {
    const token = request.headers['x-token'];
    if (!token) return rest.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return rest.status(401).send({ error: 'Unauthorized' });

    const users = await dbClient.db.collection('users');
    const user = await users.findOne({ _id: ObjectId(userId) });
    if (!user) return rest.status(401).send({ error: 'Unauthorized' });

    const parentId = request.query.parentId || 0;
    const page = request.query.page || 0;
    const limit = 20;
    const files = await dbClient.db.collection('files');
    const parentFiles = await files
      .aggregate([
        { $match: { parentId, userId } },
        { $skip: page * limit },
        { $limit: limit },
      ])
      .toArray();

    return rest.send(
      parentFiles.map((file) => {
        const obj = { ...file };
        obj.id = obj._id;
        delete obj._id;
        delete obj.localPath;
        return obj;
      }),
    );
  }
  static async putPublish(request, rest) {
    const token = request.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return rest.status(401).send({ error: 'Unauthorized' });

    const users = await dbClient.db.collection('users');
    const user = await users.findOne({ _id: ObjectId(userId) });
    if (!user) return rest.status(401).send({ error: 'Unauthorized' });

    const fileId = request.params.id;
    const files = await dbClient.db.collection('files');
    const file = await files.findOne({ _id: ObjectId(fileId), userId });
    if (!file) return rest.status(404).send({ error: 'Not found' });

    await files.updateOne(file, {
      $set: { isPublic: true },
    });
    file.id = file._id;
    file.isPublic = true;
    delete file._id;
    delete file.localPath;
    return rest.send(file);
  }
  static async putUnpublish(request, rest) {
    const token = request.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return rest.status(401).send({ error: 'Unauthorized' });

    const users = await dbClient.db.collection('users');
    const user = await users.findOne({ _id: ObjectId(userId) });
    if (!user) return rest.status(401).send({ error: 'Unauthorized' });

    const fileId = request.params.id;
    const files = await dbClient.db.collection('files');
    const file = await files.findOne({ _id: ObjectId(fileId), userId });
    if (!file) return rest.status(404).send({ error: 'Not found' });

    await files.updateOne(file, {
      $set: { isPublic: false },
    });
    file.id = file._id;
    file.isPublic = false;
    delete file._id;
    delete file.localPath;
    return rest.send(file);
  }
}
module.exports = FilesController;
