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
      guild_id BIGINT NOT NULL,
      name VARCHAR(100) NOT NULL,
      prefix VARCHAR(3) NOT NULL DEFAULT '!',
      global_denylist_role BIGINT NULL,
      global_allowlist_role BIGINT NULL,
      global_expire INT NULL DEFAULT 21600000,
      report_expire INT NULL DEFAULT 7200000,
      server_id INT NULL,
      start_message VARCHAR(200) NOT NULL DEFAULT '**%name** pickup started\n\n%teams\n\n%map[Map: **%map**]\n%ip[IP: **%ip**] %password[Password: **%password**]',
      sub_message VARCHAR(200) NOT NULL DEFAULT 'sub required for **%name** pickup\n%ip[IP: **%ip**] %password[Password: **%password**]',
      notify_message VARCHAR(200) NOT NULL DEFAULT 'your %name pickup started\n%ip[IP: **%ip**] %password[Password: **%password**]',
      promotion_delay INT NOT NULL DEFAULT 3600000,
      last_promote DATETIME NULL,
      iteration_time INT NOT NULL DEFAULT 20000,
      afk_time INT NOT NULL DEFAULT 1800000,
      afk_check_iterations TINYINT NOT NULL DEFAULT 2,
      picking_iterations TINYINT NOT NULL DEFAULT 3,
      map_vote_iterations TINYINT NOT NULL DEFAULT 2,
      captain_selection_iterations TINYINT NOT NULL DEFAULT 2,
      trust_time INT NOT NULL DEFAULT 86400000,
      explicit_trust TINYINT,
      max_avg_elo_variance SMALLINT NOT NULL DEFAULT '300',
      max_rank_rating_cap SMALLINT NOT NULL DEFAULT '4000',
      warn_streaks TINYINT NOT NULL DEFAULT 3,
      warns_until_ban TINYINT NOT NULL DEFAULT 2,
      warn_streak_expiration INT NOT NULL DEFAULT 604800000,
      warn_expiration_time INT NOT NULL DEFAULT 172800000,
      warn_ban_time INT NOT NULL DEFAULT 86400000,
      warn_ban_time_multiplier TINYINT NOT NULL DEFAULT 2,
      last_check DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id))
      ENGINE = InnoDB;
        `,
    `
    CREATE TABLE IF NOT EXISTS guild_channels (
      guild_id BIGINT NOT NULL,
      channel_id BIGINT NOT NULL,
      channel_type ENUM('pickup', 'listen') NOT NULL,
      INDEX guild_id_idx (guild_id ASC) VISIBLE,
      UNIQUE(guild_id, channel_id, channel_type),
      CONSTRAINT fk_guild_channels
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE) 
        ENGINE = InnoDB;
        `,
    `
    CREATE TABLE IF NOT EXISTS teams (
      guild_id BIGINT NOT NULL,
      team_id VARCHAR(2) NOT NULL,
      name VARCHAR(30) NOT NULL,
      UNIQUE INDEX teams_UNIQUE (guild_id ASC, team_id ASC),
      CONSTRAINT fk_teams_guild_id
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
    ENGINE = InnoDB;  
    `,
    `
    CREATE TABLE IF NOT EXISTS commands (
      name VARCHAR(20) NOT NULL,
      disabled TINYINT NOT NULL DEFAULT 0,
      PRIMARY KEY (name))
      ENGINE = InnoDB;    
        `,
    `
    CREATE TABLE IF NOT EXISTS guild_disabled_commands (
      guild_id BIGINT NOT NULL,
      command_name VARCHAR(20) NOT NULL,
      INDEX guild_id_idx (guild_id ASC) VISIBLE,
      INDEX command_name_idx (command_name ASC) VISIBLE,
      UNIQUE INDEX guild_id_UNIQUE (guild_id ASC) VISIBLE,
      UNIQUE INDEX command_name_UNIQUE (command_name ASC) VISIBLE,
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
        ENGINE = InnoDB;
        `,
    `
    CREATE TABLE IF NOT EXISTS guild_command_settings (
      guild_id BIGINT NOT NULL,
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
        ENGINE = InnoDB;  
        `,
    `
    CREATE TABLE IF NOT EXISTS guild_roles (
      guild_id BIGINT NOT NULL,
      role_id BIGINT NOT NULL,
      INDEX guild_id_idx (guild_id ASC) VISIBLE,
      INDEX guild_role_id_idx (role_id ASC) VISIBLE,
      UNIQUE(guild_id, role_id),
      CONSTRAINT fk_guild_roles
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
        ENGINE = InnoDB;
        `,
    `
    CREATE TABLE IF NOT EXISTS guild_role_command_permissions (
      guild_role_id BIGINT NOT NULL,
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
        ENGINE = InnoDB;   
        `,
    `
    CREATE TABLE IF NOT EXISTS bot_permissions (
      permission_name VARCHAR(45) NOT NULL,
      PRIMARY KEY (permission_name))
      ENGINE = InnoDB;     
        `,
    `
    CREATE TABLE IF NOT EXISTS guild_role_bot_permissions (
      guild_role_id BIGINT NOT NULL,
      bot_permission_name VARCHAR(45) NOT NULL,
      INDEX guild_role_idx (guild_role_id ASC) VISIBLE,
      INDEX bot_permission_name_idx (bot_permission_name ASC) VISIBLE,
      UNIQUE(guild_role_id, bot_permission_name),
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
        ENGINE = InnoDB;     
        `,
    `
    CREATE TABLE IF NOT EXISTS players (
      id INT NOT NULL AUTO_INCREMENT,
      guild_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      notifications TINYINT NOT NULL DEFAULT 1,
      trusted TINYINT NULL,
      current_nick VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      INDEX guild_id_idx (guild_id ASC) VISIBLE,
      CONSTRAINT fk_players
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
        ENGINE = InnoDB;     
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
        ENGINE = InnoDB;    
        `,
    `
    CREATE TABLE IF NOT EXISTS player_nicks (
      id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
      player_id INT NULL,
      nick VARCHAR(32) NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX player_id_idx (player_id ASC) VISIBLE,
      CONSTRAINT fk_player_nicks
        FOREIGN KEY (player_id)
        REFERENCES players (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
        ENGINE = InnoDB;  
        `,
    `
    CREATE TABLE IF NOT EXISTS pickup_configs (
      id INT NOT NULL AUTO_INCREMENT,
      guild_id BIGINT NOT NULL,
      name VARCHAR(20) NOT NULL,
      is_enabled TINYINT NOT NULL DEFAULT '1',
      player_count SMALLINT NOT NULL,
      team_count SMALLINT NOT NULL DEFAULT 2,
      is_default_pickup TINYINT NOT NULL DEFAULT 0,
      is_rated TINYINT NULL DEFAULT 0,
      max_rank_rating_cap SMALLINT NULL DEFAULT NULL,
      mappool_id INT NULL,
      map_vote TINYINT NOT NULL DEFAULT 0,
      afk_check TINYINT NOT NULL DEFAULT 0,
      captain_selection ENUM('manual', 'auto') NOT NULL DEFAULT 'auto',
      pick_mode ENUM('no_teams', 'manual', 'random', 'elo', 'autopick') NOT NULL DEFAULT 'no_teams',
      allowlist_role BIGINT NULL,
      denylist_role BIGINT NULL,
      promotion_role BIGINT NULL,
      captain_role BIGINT NULL,
      server_id INT NULL,
      INDEX guild_id_idx (guild_id ASC) VISIBLE,
      PRIMARY KEY (id),
      CONSTRAINT fk_pickup_configs
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
        ENGINE = InnoDB;    
        `,
    `
    CREATE TABLE IF NOT EXISTS player_ratings (
      player_id INT NOT NULL,
      pickup_config_id INT NOT NULL,
      rating DOUBLE NOT NULL,
      variance DOUBLE NOT NULL,
      INDEX fk_player_ratings_pickup_config_id_idx (pickup_config_id ASC) VISIBLE,
      UNIQUE INDEX rating_UNIQUE (player_id, pickup_config_id) VISIBLE,
      CONSTRAINT fk_player_ratings_pickup_config_id
        FOREIGN KEY (pickup_config_id)
        REFERENCES pickup_configs (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_player_ratings_player_id
        FOREIGN KEY (player_id)
        REFERENCES players (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
    ENGINE = InnoDB;
    `,
    `
    CREATE TABLE IF NOT EXISTS maps (
      id INT NOT NULL AUTO_INCREMENT,
      guild_id BIGINT NOT NULL,
      map VARCHAR(45) NULL,
      INDEX guild_id_idx (guild_id ASC) VISIBLE,
      PRIMARY KEY (id),
      CONSTRAINT fk_maps
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
        ENGINE = InnoDB;      
        `,
    `
    CREATE TABLE IF NOT EXISTS map_pool_names (
      id INT NOT NULL AUTO_INCREMENT,
      guild_id BIGINT NOT NULL,
      name VARCHAR(45) NULL,
      INDEX guild_id_idx (guild_id ASC) VISIBLE,
      UNIQUE INDEX name_UNIQUE (name ASC) VISIBLE,
      PRIMARY KEY (id),
      CONSTRAINT fk_map_pool_names
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
        ENGINE = InnoDB;
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
        ENGINE = InnoDB;      
        `,
    `
    CREATE TABLE IF NOT EXISTS pickups (
      id INT NOT NULL AUTO_INCREMENT,
      guild_id BIGINT NOT NULL,
      pickup_config_id INT NOT NULL,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      map VARCHAR(45) NULL,
      is_rated TINYINT NOT NULL DEFAULT 0,
      has_teams TINYINT NOT NULL,
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
        ENGINE = InnoDB; 
        `,
    `
    CREATE TABLE IF NOT EXISTS pickup_players (
      pickup_id INT NOT NULL,
      player_id INT NOT NULL,
      team VARCHAR(2) NULL,
      is_captain TINYINT NOT NULL DEFAULT 0,
      rating DOUBLE NULL DEFAULT NULL,
      variance DOUBLE NULL DEFAULT NULL,
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
        ENGINE = InnoDB; 
        `,
    `
    CREATE TABLE IF NOT EXISTS state_rating_reports (
      pickup_id INT NOT NULL,
      team VARCHAR(2) NOT NULL,
      outcome ENUM('win', 'draw', 'loss') NOT NULL,
      INDEX fk_pickup_id_state_rating_reports_idx (pickup_id ASC) VISIBLE,
      CONSTRAINT fk_pickup_id_state_rating_reports
        FOREIGN KEY (pickup_id)
        REFERENCES pickups (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
    ENGINE = InnoDB;
    `,
    `
    CREATE TABLE IF NOT EXISTS rated_results (
      pickup_id INT NOT NULL,
      team VARCHAR(2) NOT NULL,
      result ENUM('win', 'draw', 'loss') NOT NULL,
      INDEX pickup_id_idx (pickup_id ASC) VISIBLE,
      CONSTRAINT fk_rated_results_pickup
        FOREIGN KEY (pickup_id)
        REFERENCES pickups (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
    ENGINE = InnoDB;
        `,
    `
    CREATE TABLE IF NOT EXISTS pickup_servers (
      id INT NOT NULL AUTO_INCREMENT,
      guild_id BIGINT NOT NULL,
      name VARCHAR(45) NULL,
      ip VARCHAR(45) NOT NULL,
      password VARCHAR(45) NULL,
      PRIMARY KEY (id),
      CONSTRAINT fk_pickup_servers
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
        ENGINE = InnoDB;       
        `,
    `
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id BIGINT NOT NULL,
      type VARCHAR(45) NOT NULL,
      value VARCHAR(45) NOT NULL,
      INDEX guild_id_idx (guild_id ASC) VISIBLE,
      CONSTRAINT fk_guild_settings
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
        ENGINE = InnoDB;     
        `,
    `
    CREATE TABLE IF NOT EXISTS banned_guilds (
      guild_id BIGINT NOT NULL,
      PRIMARY KEY (guild_id))
      ENGINE = InnoDB;     
        `,
    `
    CREATE TABLE IF NOT EXISTS bans (
      id INT NOT NULL AUTO_INCREMENT,
      guild_id BIGINT NOT NULL,
      player_id INT NOT NULL,
      issuer_player_id INT NOT NULL,
      reason VARCHAR(128) NULL,
      ends_at DATETIME NULL,
      is_active TINYINT NULL DEFAULT 1,
      is_warn_ban TINYINT NOT NULL DEFAULT 1,
      permanent TINYINT NOT NULL DEFAULT 0,
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
        ENGINE = InnoDB;
        `,
    `
    CREATE TABLE IF NOT EXISTS warns (
      id INT NOT NULL AUTO_INCREMENT,
      guild_id BIGINT NOT NULL,
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
        ENGINE = InnoDB;     
        `,
    `
    CREATE TABLE IF NOT EXISTS state_pickup (
      guild_id BIGINT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      pickup_config_id INT NOT NULL,
      stage ENUM('fill', 'afk_check', 'picking_manual', 'mapvote') NULL DEFAULT 'fill',
      in_stage_since DATETIME NULL,
      stage_iteration TINYINT NULL,
      INDEX fk_state_pickup_guild_id_idx (guild_id ASC) VISIBLE,
      INDEX fk_state_pickup_pickup_config_id_idx (pickup_config_id ASC) VISIBLE,
      UNIQUE(pickup_config_id, guild_id),
      CONSTRAINT fk_state_pickup_guild_id
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_state_pickup_pickup_config_id
        FOREIGN KEY (pickup_config_id)
        REFERENCES pickup_configs (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
        ENGINE = InnoDB;
      `,
    `
    CREATE TABLE IF NOT EXISTS state_pickup_players (
      guild_id BIGINT NOT NULL,
      player_id BIGINT NOT NULL,
      pickup_config_id INT NULL,
      INDEX fk_state_pickup_players_guild_id_idx (guild_id ASC) VISIBLE,
      INDEX fk_state_pickup_players_pickup_config_id_idx (pickup_config_id ASC) VISIBLE,
      CONSTRAINT fk_state_pickup_players_guild_id
        FOREIGN KEY (guild_id)
        REFERENCES guilds (guild_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_state_pickup_players_pickup_config_id
        FOREIGN KEY (pickup_config_id)
        REFERENCES pickup_configs (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE)
        ENGINE = InnoDB;
      `,
    `
      CREATE TABLE IF NOT EXISTS state_guild_player (
        guild_id BIGINT NOT NULL,
        player_id BIGINT NOT NULL,
        ao_expire DATETIME NULL,
        pickup_expire DATETIME NULL,
        last_add DATETIME NULL,
        is_afk TINYINT NULL,
        sub_request BIGINT NULL DEFAULT NULL,
        INDEX fk_state_guild_player_guild_id_idx (guild_id ASC) VISIBLE,
        UNIQUE(guild_id, player_id),
        CONSTRAINT fk_state_guild_player_guild_id
          FOREIGN KEY (guild_id)
          REFERENCES guilds (guild_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE)
          ENGINE = InnoDB;
      `,
    `
      CREATE TABLE IF NOT EXISTS state_teams (
        guild_id BIGINT NOT NULL,
        pickup_config_id INT NOT NULL,
        player_id BIGINT NOT NULL,
        team VARCHAR(2) NULL,
        is_captain TINYINT NULL DEFAULT 0,
        captain_turn TINYINT NULL DEFAULT 0,
        INDEX fk_state_teams_pickup_config_id_idx (pickup_config_id ASC) VISIBLE,
        CONSTRAINT fk_state_teams_guild_id
          FOREIGN KEY (guild_id)
          REFERENCES guilds (guild_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        CONSTRAINT fk_state_teams_pickup_config_id
          FOREIGN KEY (pickup_config_id)
          REFERENCES pickup_configs (id)
          ON DELETE CASCADE
          ON UPDATE CASCADE)
          ENGINE = InnoDB;
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
    return;
  } catch (err) {
    await conn.query('ROLLBACK');
    await conn.release();
  }
});