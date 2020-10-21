import mysql2 from 'mysql2';
import { PoolConnection, Pool } from 'mysql2/promise';

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

export const transaction = (async (conn: PoolConnection | Pool,
    queriesFunc: (conn: PoolConnection | Pool) => Promise<any>) => {
    // Only the connection got a release function
    if ('release' in conn) {
        return await queriesFunc(conn);
    } else if ('getConnection' in conn) {
        const c = await conn.getConnection();

        try {
            await c.beginTransaction();
            const res = await queriesFunc(c);

            await c.commit();

            return res;
        } catch (e) {
            c.rollback();
            throw e;
        } finally {
            c.release();
        }
    }
});