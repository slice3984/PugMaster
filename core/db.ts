import mysql2 from 'mysql2';
import ConfigTool from './configTool';

const config = ConfigTool.getConfig();

export default mysql2.createPool({
    host: config.db.server,
    user: config.db.user,
    password: config.db.password,
    database: config.db.db,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    supportBigNumbers: true,
    bigNumberStrings: false
}).promise();