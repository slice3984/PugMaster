import db from '../core/db';

export default class MappoolModel {
    private constructor() { }

    static async isMappoolStored(guildId: bigint, name: string): Promise<boolean> {
        const stored = await db.execute(`
        SELECT COUNT(*) AS cnt FROM map_pool_names
        WHERE guild_id = ? AND name = ?
        `, [guildId, name]);

        return stored[0][0].cnt;
    }

    static async addMappool(guildId: bigint, name: string) {
        await db.execute(`
        INSERT INTO map_pool_names
        (guild_id, name) VALUES (?, ?)
        `, [guildId, name]);
    }

    static async getDuplicates(guildId: bigint, ...maps) {
        const duplicates = await db.execute(`
        SELECT map FROM maps WHERE guild_id = ?
        AND map IN (${Array(maps.length).fill('?').join(',')}) 
        `, [guildId, ...maps]);

        return duplicates[0].map(row => row.map);
    }

    static async addMaps(guildId: bigint, ...maps) {
        let values = [];

        maps.forEach(map => {
            values.push(guildId, map);
        });

        await db.execute(`
        INSERT INTO maps
        (guild_id, map) VALUES ${Array(maps.length).fill('(?, ?)').join(',')}
        `, values);
    };

    static async getMapIds(guildId: bigint, ...maps) {
        const result = await db.execute(`
        SELECT id FROM maps WHERE guild_id = ?
        AND map IN (${Array(maps.length).fill('?').join(',')})
        `, [guildId, ...maps]);

        return result[0].map(row => row.id);
    }

    static async getMaps(guildId: bigint, name) {
        const maps = await db.execute(`
        SELECT map FROM map_pool_names a
        JOIN map_pool_maps b ON a.id = b.pool_id
        JOIN maps c ON c.id = b.map_id
        WHERE a.guild_id = ? AND a.name = ?;
        `, [guildId, name]);

        return maps[0].map(row => row.map);
    }

    static async areMapsUsedInPools(guildId: bigint, ...maps) {
        const mapIds = await MappoolModel.getMapIds(guildId, ...maps);

        const mapsInUse = await db.execute(`
        SELECT DISTINCT(c.map) AS map FROM map_pool_names a
        JOIN map_pool_maps b ON b.pool_id = a.id
        JOIN maps c ON b.map_id = c.id
        AND a.guild_id = ? AND b.map_id IN (${Array(mapIds.length).fill('?').join(',')})
        `, [guildId, ...mapIds]);

        return mapsInUse[0].map(row => row.map);
    }

    static async getPools(guildId: bigint, ...poolNames) {
        let pools;

        if (poolNames.length === 0) {
            pools = await db.execute(`
            SELECT id, name FROM map_pool_names WHERE guild_id = ?
            `, [guildId]);
        } else {
            pools = await db.execute(`
            SELECT id, name FROM map_pool_names WHERE guild_id = ?
            AND name IN (${Array(poolNames.length).fill('?').join(',')})
            `, [guildId, ...poolNames]);
        }

        return pools[0];
    }

    static async getPoolName(guildId: bigint, poolId) {
        const name = await db.execute(`
        SELECT name FROM map_pool_names
        WHERE guild_id = ? AND id = ?
        `, [guildId, poolId]);

        return name[0][0].name;
    }

    static async addMapsToPool(guildId: bigint, poolName: string, ...maps) {
        await MappoolModel.addMapsToGlobalPool(guildId, ...maps);
        const mapIds = await MappoolModel.getMapIds(guildId, ...maps);

        const poolId = await (await db.execute(`
        SELECT id FROM map_pool_names WHERE guild_id = ? AND name = ?
        `, [guildId, poolName]))[0][0].id;

        let values = [];

        mapIds.forEach(id => {
            values.push(poolId, +id);
        });

        await db.execute(`
        INSERT INTO map_pool_maps
        VALUES ${Array(mapIds.length).fill('(?, ?)').join(',')}
        `, values);
    }

    static async removeMapsFromPool(guildId: bigint, poolName: string, ...maps) {
        const mapIds = await MappoolModel.getMapIds(guildId, ...maps);

        const poolId = await (await db.execute(`
        SELECT id FROM map_pool_names WHERE guild_id = ? AND name = ?
        `, [guildId, poolName]))[0][0].id;

        await db.execute(`
        DELETE FROM map_pool_maps WHERE pool_id = ?
        AND map_id IN (${Array(mapIds.length).fill('?').join(',')})
        `, [poolId, ...mapIds]);

        const usedInPools = await MappoolModel.areMapsUsedInPools(guildId, ...maps);
        const toRemove = maps.filter(map => !usedInPools.includes(map));

        if (toRemove.length) {
            await MappoolModel.removeMapsFromGlobalPool(guildId, ...toRemove);
        }
    }

    static async addMapsToGlobalPool(guildId: bigint, ...maps) {
        const duplicates = await MappoolModel.getDuplicates(guildId, ...maps);
        const mapsToInsert = [...new Set(maps.filter(map => !duplicates.includes(map)))];

        if (mapsToInsert.length === 0) {
            return mapsToInsert;
        }

        let values = [];

        mapsToInsert.forEach(map => {
            values.push(guildId, map);
        })

        await db.execute(`
        INSERT INTO maps (guild_id, map)
        VALUES ${Array(mapsToInsert.length).fill('(?, ?)').join(',')}
        `, values);

        return mapsToInsert;
    }

    static async removeMapsFromGlobalPool(guildId: bigint, ...maps) {
        await db.execute(`
        DELETE FROM maps WHERE guild_id = ?
        AND map IN (${Array(maps.length).fill('?').join(',')})
        `, [guildId, ...maps]);
    }

    static async removeMapPools(guildId: bigint, ...pools) {
        // Get all stored maps first
        let maps = [];

        for (const pool of pools) {
            const storedMaps = await MappoolModel.getMaps(guildId, pool);
            maps.push(...storedMaps);
        }

        const poolIds = await (await db.execute(`
        SELECT id FROM map_pool_names WHERE guild_id = ?
        AND name IN (${Array(pools.length).fill('?').join(',')})
        `, [guildId, ...pools]))[0].map(row => row.id);

        maps = [...new Set(maps)];

        await db.execute(`
        DELETE FROM map_pool_names WHERE guild_id = ? 
        AND name IN (${Array(pools.length).fill('?').join(',')})
        `, [guildId, ...pools]);

        const mapsInUse = await MappoolModel.areMapsUsedInPools(guildId, ...maps);
        const unusedMaps = maps.filter(map => !mapsInUse.includes(map));
        await MappoolModel.removeMapsFromGlobalPool(guildId, ...unusedMaps);

        // Update pickups
        await db.execute(`
        UPDATE pickup_configs SET mappool_id = null
        WHERE guild_id = ? AND mappool_id IN (${Array(poolIds.length).fill('?').join(',')})
        `, [guildId, ...poolIds]);
    }
}