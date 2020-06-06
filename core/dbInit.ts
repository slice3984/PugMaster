import db from './db';
import ConfigTool from './configTool';

export const checkDb = () => new Promise(async (res, _rej) => {
  const result = await db.query(`
    SELECT COUNT(*) as tb
    FROM
        information_schema.tables
    WHERE
        table_schema = '${ConfigTool.getConfig().db.db}' 
    AND
        table_name = 'guilds'
    LIMIT 1;
    `)

  if (result[0][0].tb) {
    res(true);
  } else {
    res(false);
  }
});

export const createTables = () => new Promise(async (res, _req) => {
  const dbQueries = [
    `
        CREATE TABLE IF NOT EXISTS guilds (
            guild_id BIGINT(20) NOT NULL,
            name VARCHAR(100) NOT NULL,
            prefix VARCHAR(3) NOT NULL DEFAULT '!',
            global_promotion_role BIGINT(20) NULL,
            global_blacklist_role BIGINT(20) NULL,
            global_whitelist_role BIGINT(20) NULL,
            global_expire INT NULL DEFAULT 21600000,
            default_server_ip VARCHAR(45) NULL DEFAULT 'Change me',
            default_server_password VARCHAR(45) NULL DEFAULT 'password',
            last_promote DATETIME NULL,
            warn_streaks TINYINT NOT NULL DEFAULT 3,
            warn_streak_expiration INT NOT NULL DEFAULT 604800000,
            warn_expiration_time INT NOT NULL DEFAULT 172800000,
            warn_ban_time INT NOT NULL DEFAULT 86400000,
            warn_ban_time_multiplier TINYINT NOT NULL DEFAULT 2,
            last_check DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (guild_id))       
        `,
    `
        CREATE TABLE IF NOT EXISTS guild_channels (
            guild_id BIGINT(20) NOT NULL,
            channel_id BIGINT(20) NOT NULL,
            channel_type ENUM('pickup-text', 'pickup-static', 'listen') NOT NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            CONSTRAINT fk_guild_channels
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)       
        `,
    `
        CREATE TABLE IF NOT EXISTS commands (
            name VARCHAR(20) NOT NULL,
            disabled TINYINT NOT NULL DEFAULT 0,
            PRIMARY KEY (name))        
        `,
    `
        CREATE TABLE IF NOT EXISTS guild_disabled_commands (
            guild_id BIGINT(20) NOT NULL,
            command_name VARCHAR(20) NOT NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            INDEX command_name_idx (command_name ASC) VISIBLE,
            CONSTRAINT fk_guild_disabled_commands
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT command_name
              FOREIGN KEY (command_name)
              REFERENCES commands (name)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS guild_command_settings (
            guild_id BIGINT(20) NOT NULL,
            command_name VARCHAR(20) NOT NULL,
            value VARCHAR(50) NOT NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            CONSTRAINT fk_guild_command_settings
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_guild_command_settings_command
              FOREIGN KEY (command_name)
              REFERENCES commands (name)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS guild_roles (
            guild_id BIGINT(20) NOT NULL,
            role_id BIGINT(20) NOT NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            INDEX guild_role_id_idx (role_id ASC) VISIBLE,
            CONSTRAINT fk_guild_roles
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS guild_role_command_permissions (
            guild_role_id BIGINT(20) NOT NULL,
            command_name VARCHAR(20) NOT NULL,
            INDEX guild_role_id_idx (guild_role_id ASC) VISIBLE,
            INDEX command_name_idx (command_name ASC) VISIBLE,
            CONSTRAINT fk_guild_role_command_permissions
              FOREIGN KEY (guild_role_id)
              REFERENCES guild_roles (role_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_guild_role_command_permissions_name
              FOREIGN KEY (command_name)
              REFERENCES commands (name)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS bot_permissions (
            permission_name VARCHAR(45) NOT NULL,
            PRIMARY KEY (permission_name))        
        `,
    `
        CREATE TABLE IF NOT EXISTS guild_role_bot_permissions (
            guild_role_id BIGINT(20) NOT NULL,
            bot_permission_name VARCHAR(45) NOT NULL,
            INDEX guild_role_idx (guild_role_id ASC) VISIBLE,
            INDEX bot_permission_name_idx (bot_permission_name ASC) VISIBLE,
            CONSTRAINT fk_guild_role_bot_permissions
              FOREIGN KEY (guild_role_id)
              REFERENCES guild_roles (role_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_guld_role_bot_permissions_name
              FOREIGN KEY (bot_permission_name)
              REFERENCES bot_permissions (permission_name)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS players (
            id INT NOT NULL AUTO_INCREMENT,
            guild_id BIGINT(20) NOT NULL,
            user_id BIGINT(20) NOT NULL,
            elo INT NULL,
            notifications TINYINT NOT NULL DEFAULT 1,
            current_nick VARCHAR(32) NOT NULL,
            PRIMARY KEY (id),
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            CONSTRAINT fk_players
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS player_settings (
            player_id INT NOT NULL,
            type VARCHAR(45) NOT NULL,
            value VARCHAR(45) NOT NULL,
            INDEX player_id_idx (player_id ASC) VISIBLE,
            CONSTRAINT fk_player_settings
              FOREIGN KEY (player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS player_nicks (
            player_id INT NULL,
            nick VARCHAR(32) NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX player_id_idx (player_id ASC) VISIBLE,
            CONSTRAINT fk_player_nicks
              FOREIGN KEY (player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS map_pool_names (
            id INT NOT NULL AUTO_INCREMENT,
            guild_id BIGINT(20) NOT NULL,
            name VARCHAR(45) NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            UNIQUE INDEX name_UNIQUE (name ASC) VISIBLE,
            PRIMARY KEY (id),
            CONSTRAINT fk_map_pool_names
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS pickup_servers (
            id INT NOT NULL AUTO_INCREMENT,
            guild_id BIGINT(20) NOT NULL,
            name VARCHAR(45) NULL,
            ip VARCHAR(45) NOT NULL,
            password VARCHAR(45) NULL,
            PRIMARY KEY (id),
            CONSTRAINT fk_pickup_servers
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS pickup_configs (
            id INT NOT NULL AUTO_INCREMENT,
            guild_id BIGINT(20) NOT NULL,
            name VARCHAR(20) NOT NULL,
            player_count SMALLINT NOT NULL,
            team_count SMALLINT NOT NULL DEFAULT 2,
            is_default_pickup TINYINT NOT NULL DEFAULT 0,
            mappool_id INT NULL,
            afk_check TINYINT NOT NULL DEFAULT 0,
            pick_mode ENUM('no_teams', 'manual', 'elo') NOT NULL DEFAULT 'no_teams',
            whitelist_role BIGINT(20) NULL,
            blacklist_role BIGINT(20) NULL,
            promotion_role BIGINT(20) NULL,
            captain_role BIGINT(20) NULL,
            server_id INT NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            PRIMARY KEY (id),
            CONSTRAINT fk_pickup_configs
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)
        `,
    `
        CREATE TABLE IF NOT EXISTS maps (
            id INT NOT NULL AUTO_INCREMENT,
            guild_id BIGINT(20) NOT NULL,
            map VARCHAR(45) NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            PRIMARY KEY (id),
            CONSTRAINT fk_maps
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS map_pool_maps (
            pool_id INT NOT NULL,
            map_id INT NOT NULL,
            INDEX pool_id_idx (pool_id ASC) VISIBLE,
            INDEX map_id_idx (map_id ASC) VISIBLE,
            CONSTRAINT pool_id
              FOREIGN KEY (pool_id)
              REFERENCES map_pool_names (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT map_id
              FOREIGN KEY (map_id)
              REFERENCES maps (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS pickups (
            id INT NOT NULL AUTO_INCREMENT,
            guild_id BIGINT(20) NOT NULL,
            pickup_config_id INT NOT NULL,
            started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_rated TINYINT NOT NULL DEFAULT 0,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            INDEX pickup_config_id_idx (pickup_config_id ASC) VISIBLE,
            PRIMARY KEY (id),
            CONSTRAINT fk_pickups
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_pickups_config
              FOREIGN KEY (pickup_config_id)
              REFERENCES pickup_configs (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS pickup_players (
            pickup_id INT NOT NULL,
            player_id INT NOT NULL,
            INDEX pickup_id_idx (pickup_id ASC) VISIBLE,
            INDEX player_id_idx (player_id ASC) VISIBLE,
            CONSTRAINT pickup_id
              FOREIGN KEY (pickup_id)
              REFERENCES pickups (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT player_id
              FOREIGN KEY (player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS rated_results (
            player_id INT NOT NULL,
            pickup_id INT NOT NULL,
            result ENUM('win', 'loss', 'draw') NULL,
            INDEX player_id_idx (player_id ASC) VISIBLE,
            INDEX pickup_id_idx (pickup_id ASC) VISIBLE,
            CONSTRAINT fk_rated_results_player
              FOREIGN KEY (player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_rated_results_pickup
              FOREIGN KEY (pickup_id)
              REFERENCES pickups (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS guild_settings (
            guild_id BIGINT(20) NOT NULL,
            type VARCHAR(45) NOT NULL,
            value VARCHAR(45) NOT NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            CONSTRAINT fk_guild_settings
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS banned_guilds (
            guild_id BIGINT(20) NOT NULL,
            PRIMARY KEY (guild_id))        
        `,
    `
        CREATE TABLE IF NOT EXISTS bans (
            id INT NOT NULL AUTO_INCREMENT,
            guild_id BIGINT(20) NOT NULL,
            player_id INT NOT NULL,
            issuer_player_id INT NOT NULL,
            reason VARCHAR(128) NULL,
            permanent TINYINT NOT NULL DEFAULT 0,
            time DATETIME NOT NULL,
            PRIMARY KEY (id),
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            INDEX player_id_idx (player_id ASC) VISIBLE,
            INDEX issuer_player_id_idx (issuer_player_id ASC) VISIBLE,
            CONSTRAINT fk_bans
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_bans_player
              FOREIGN KEY (player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_bans_issuer_player
              FOREIGN KEY (issuer_player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS warns (
            id INT NOT NULL AUTO_INCREMENT,
            guild_id BIGINT(20) NOT NULL,
            player_id INT NOT NULL,
            issuer_player_id INT NOT NULL,
            reason VARCHAR(128) NULL,
            is_active TINYINT NOT NULL DEFAULT 1,
            warned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            INDEX player_id_idx (player_id ASC) VISIBLE,
            INDEX issuer_player_id_idx (issuer_player_id ASC) VISIBLE,
            CONSTRAINT fk_warns
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_warns_player
              FOREIGN KEY (player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_wanrs_issuer_player
              FOREIGN KEY (issuer_player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS state_active_pickups (
            guild_id BIGINT(20) NOT NULL,
            player_id INT NOT NULL,
            pickup_config_id INT NOT NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            INDEX player_id_idx (player_id ASC) VISIBLE,
            INDEX pickup_config_id_idx (pickup_config_id ASC) VISIBLE,
            CONSTRAINT fk_state_active_pickups
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_state_active_pickups_player_id
              FOREIGN KEY (player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_state_active_pickups_config
              FOREIGN KEY (pickup_config_id)
              REFERENCES pickup_configs (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)        
        `,
    `
        CREATE TABLE IF NOT EXISTS state_active_expires (
            guild_id BIGINT(20) NOT NULL,
            player_id INT NOT NULL,
            expiration_date DATETIME NOT NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            INDEX player_id_idx (player_id ASC) VISIBLE,
            CONSTRAINT fk_state_active_expires
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_state_active_expires_player
              FOREIGN KEY (player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)       
        `,
    `
        CREATE TABLE IF NOT EXISTS state_active_aos (
            guild_id BIGINT(20) NOT NULL,
            player_id INT NOT NULL,
            expiration_date DATETIME NOT NULL,
            INDEX guild_id_idx (guild_id ASC) VISIBLE,
            INDEX player_id_idx (player_id ASC) VISIBLE,
            CONSTRAINT fk_state_active_aos
              FOREIGN KEY (guild_id)
              REFERENCES guilds (guild_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
            CONSTRAINT fk_state_active_aos_player
              FOREIGN KEY (player_id)
              REFERENCES players (id)
              ON DELETE CASCADE
              ON UPDATE CASCADE)       
        `,
    `
      CREATE TABLE IF NOT EXISTS state_add_times (
        guild_id BIGINT(20) NOT NULL,
        player_id INT NOT NULL,
        added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX fk_state_add_times_idx (guild_id ASC) VISIBLE,
        INDEX fk_state_add_times_player_idx (player_id ASC) VISIBLE,
        CONSTRAINT fk_state_add_times
          FOREIGN KEY (guild_id)
          REFERENCES guilds (guild_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        CONSTRAINT fk_state_add_times_player
          FOREIGN KEY (player_id)
          REFERENCES players (id)
          ON DELETE CASCADE
          ON UPDATE CASCADE)    
      `
  ];

  const conn = await db.getConnection();
  try {
    await conn.query('START TRANSACTION');
    dbQueries.forEach(async (query) => {
      await conn.query(query);
    });
    await conn.commit();
    await conn.release();
    res();
  } catch (err) {
    await conn.query('ROLLBACK');
    await conn.release();
  }
});