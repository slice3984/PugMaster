import Discord from 'discord.js';
import PickupModel from "../models/pickup";
import Util from "./util";
import Bot from "./bot";
import { ValidationError } from './types';
import MappoolModel from '../models/mappool';
import ServerModel from '../models/server';
import GuildSettings from './guildSettings';
import ConfigTool from './configTool';

const config = ConfigTool.getConfig();

export namespace Validator {
    export namespace Pickup {
        export function areValidKeys(...keys) {
            const validKeys = ['name', 'players', 'teams', 'default', 'mappool', 'afkcheck',
                'pickmode', 'whitelist', 'blacklist', 'promotion', 'captain', 'server'];
            const invalidKeys = keys.filter(key => !validKeys.includes(key));

            return invalidKeys;
        };

        export async function isValidPickup(guildId: bigint, pickup: string, isDuplicate = true) {
            const doesExist = await PickupModel.areValidPickups(guildId, pickup);

            if (isDuplicate && doesExist.length) {
                return true;
            } else if (isDuplicate && !doesExist.length) {
                return false;
            } else if (!isDuplicate && !doesExist.length) {
                return true;
            } else {
                return false;
            }
        }

        export async function validate(guild: Discord.Guild, pickup: string | number, ...toValidate: { key: string, value: string }[]): Promise<ValidationError[]> {
            let errors: ValidationError[] = [];
            let teamCount;
            let playerCount;
            let pickupSettings;
            let isPickupActive;

            for (const obj of toValidate) {
                let key = obj.key;
                let value = obj.value;

                switch (key) {
                    case 'name':
                        if (!isPickupActive) {
                            isPickupActive = await (await PickupModel.getActivePickups(BigInt(guild.id))).has(pickup as string);
                        }

                        if (isPickupActive) {
                            errors.push({ type: 'players', errorMessage: 'can\'t modify players when the pickup is active' });
                        }

                        if (!/^[a-zA-Z0-9]+$/.test(value)) {
                            errors.push({ type: 'name', errorMessage: 'invalid pickup name, has to be alphanumeric only' });
                            break;
                        }

                        if (value.length > 20 || value.length === 0) {
                            errors.push({ type: 'name', errorMessage: 'pickup name must be between 1-20 chars long' });
                            break;
                        }
                        break;
                    case 'players':
                        if (!isPickupActive) {
                            isPickupActive = await (await PickupModel.getActivePickups(BigInt(guild.id))).has(pickup as string);
                        }

                        if (isPickupActive) {
                            errors.push({ type: 'players', errorMessage: 'can\'t modify players when the pickup is active' });
                        }

                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: 'players', errorMessage: 'amount has to be a number' });
                            break;
                        }

                        if (!(value.length <= 3 && +value >= 2 && +value <= 100)) {
                            errors.push({ type: 'players', errorMessage: 'player count has to be in the range of 2 and 100' });
                            break;
                        }

                        if (!teamCount) {
                            teamCount = await (await PickupModel.getPickupSettings(BigInt(guild.id), pickup)).team_count;
                        }

                        if (+value % teamCount !== 0) {
                            errors.push({ type: 'players', errorMessage: `can't create even teams with the given player count (players: ${value} teams: ${teamCount})` });
                            break;
                        }
                        break;
                    case 'teams':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: 'teams', errorMessage: 'amount has to be a number' });
                            break;
                        }

                        if (!(value.length <= 2 && +value >= 2 && +value <= 10)) {
                            errors.push({ type: 'teams', errorMessage: 'team count has to be in a range of 2 and 10' });
                            break;
                        }

                        if (!playerCount) {
                            playerCount = await (await PickupModel.getPickupSettings(BigInt(guild.id), pickup)).player_count;
                        }

                        if (playerCount % +value !== 0) {
                            errors.push({ type: 'teams', errorMessage: `can't create even teams with the given team count (players: ${playerCount} teams: ${value})` });
                            break;
                        }
                        break;
                    case 'default':
                        if (!['true', 'false'].includes(value)) {
                            errors.push({ type: 'default', errorMessage: 'value has to be true or false' });
                            break;
                        }
                        break;
                    case 'mappool':
                        const validPool = await MappoolModel.isMappoolStored(BigInt(guild.id), value);

                        if (!validPool) {
                            errors.push({ type: 'mappool', errorMessage: 'given map pool not found' });
                            break;
                        }
                        break;
                    case 'afkcheck':
                        if (!['true', 'false'].includes(value)) {
                            errors.push({ type: 'afkcheck', errorMessage: 'value has to be true or false' });
                            break;
                        }
                        break;
                    case 'pickmode':
                        if (!['no_teams', 'manual', 'elo']) {
                            errors.push({ type: 'pickmode', errorMessage: 'value has to be no_teams, manual or elo' });
                            break;
                        }
                        break;
                    case 'whitelist':
                        const whitelistRole = Util.getRole(guild, value);

                        if (!whitelistRole) {
                            errors.push({ type: 'whitelist', errorMessage: 'can\'t find the given role' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if ([pickupSettings.blacklist_role, pickupSettings.promotion_role, pickupSettings.captain_role].includes(whitelistRole.id)) {
                            errors.push({ type: 'whitelist', errorMessage: 'can\'t set the same roles for different pickup specific roles' });
                            break;
                        }
                        break;
                    case 'blacklist':
                        const blacklistRole = Util.getRole(guild, value);

                        if (!blacklistRole) {
                            errors.push({ type: 'blacklist', errorMessage: 'can\'t find the given role' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if ([pickupSettings.whitelist_role, pickupSettings.promotion_role, pickupSettings.captain_role].includes(blacklistRole.id)) {
                            errors.push({ type: 'blacklist', errorMessage: 'can\'t set the same roles for different pickup specific roles' });
                            break;
                        }
                        break;
                    case 'promotion':
                        const promotionRole = Util.getRole(guild, value);

                        if (!promotionRole) {
                            errors.push({ type: 'promotion', errorMessage: 'can\'t find the given role' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if ([pickupSettings.blacklist_role, pickupSettings.whitelist_role, pickupSettings.captain_role].includes(promotionRole.id)) {
                            errors.push({ type: 'promotion', errorMessage: 'can\'t set the same roles for different pickup specific roles' });
                            break;
                        }
                        break;
                    case 'captain':
                        const captainRole = Util.getRole(guild, value);

                        if (!captainRole) {
                            errors.push({ type: 'captain', errorMessage: 'can\'t find the given role' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if ([pickupSettings.blacklist_role, pickupSettings.whitelist_role, pickupSettings.promotion_role].includes(captainRole.id)) {
                            errors.push({ type: 'captain', errorMessage: 'can\'t set the same roles for different pickup specific roles' });
                            break;
                        }
                        break;
                    case 'server':
                        const validServer = await ServerModel.isServerStored(BigInt(guild.id), value);

                        if (!validServer) {
                            errors.push({ type: 'server', errorMessage: 'can\'t find the given server' });
                            break;
                        }
                        break;
                }
            }

            return errors;
        }
    }

    export namespace Mappool {
        export async function isValidPool(guildId: bigint, name: string, isDuplicate = true): Promise<ValidationError | true> {
            const doesExist = await MappoolModel.isMappoolStored(guildId, name);

            if (isDuplicate && !doesExist) {
                return { type: 'exists', errorMessage: 'pool not found' };
            }

            if (!isDuplicate && doesExist) {
                return { type: 'exists', errorMessage: 'pool already stored' };
            }

            if (!/^[a-zA-Z0-9]+$/.test(name)) {
                return { type: 'name', errorMessage: 'invalid pool name, has to be alphanumeric only' };
            }

            if (name.length > 20 || name.length === 0) {
                return { type: 'name', errorMessage: 'pool name must be between 1-20 chars long' };

            }

            return true;
        }

        export function areValidMapNames(...maps): string[] {
            return maps.filter(map => !(map.length < 1 || map.length > 45));
        }

        export async function validate(guild: Discord.Guild, ...toValidate) {
            for (const obj of toValidate) {

            }
        }
    }

    export namespace Server {
        export async function isValidServer(guildId: bigint, name: string, isDuplicate = true): Promise<ValidationError | true> {
            const doesExist = await ServerModel.isServerStored(guildId, name);

            if (isDuplicate && !doesExist) {
                return { type: 'exists', errorMessage: 'server not found' };
            }

            if (!isDuplicate && doesExist) {
                return { type: 'exists', errorMessage: 'server already stored' };
            }

            if (!/^[a-zA-Z0-9]+$/.test(name)) {
                return { type: 'name', errorMessage: 'invalid server name, has to be alphanumeric only' };
            }

            if (name.length > 45 || name.length === 0) {
                return { type: 'name', errorMessage: 'server name must be between 1-45 chars long' };
            }

            return true;
        }

        export function isValidIp(ip) {
            if (ip.length > 45 || ip.length === 0) {
                return { type: 'ip', errorMessage: 'ip must be between 1-45 chars long' };
            }
            return true;
        }

        export function isValidPassword(ip) {
            if (ip.length > 45 || ip.length === 0) {
                return { type: 'password', errorMessage: 'password must be between 1-45 chars long' };
            }
            return true;
        }
    }

    export namespace Guild {
        export function areValidKeys(...keys) {
            const validKeys = ['prefix', 'global_expire', 'promotion', 'whitelist', 'blacklist', 'server',
                'start_message', 'sub_message', 'notify_message', 'warn_streaks', 'warn_streak_expiration',
                'warn_expiration', 'warn_bantime', 'warn_bantime_multiplier'];

            const invalidKeys = keys.filter(key => !validKeys.includes(key));

            return invalidKeys;
        }

        export async function validate(guild: Discord.Guild, guildSettings: GuildSettings, ...toValidate: { key: string, value: string }[]) {
            let errors: ValidationError[] = [];

            for (const obj of toValidate) {
                let key = obj.key;
                let value = obj.value;

                switch (key) {
                    case 'prefix':
                        if (value.length > 3) {
                            errors.push({ type: key, errorMessage: 'prefix must be between 1-3 chars long' });
                            break;
                        }

                        const currentPrefix = guildSettings.prefix;

                        if (currentPrefix === value) {
                            errors.push({ type: key, errorMessage: `prefix is already set to ${value}` });
                            break;
                        }
                        break;
                    case 'global_expire':
                        const validTime = Util.validateTimeString(value, +config.settings.MAX_GLOBAL_EXPIRE, 10800000);

                        if (validTime === 'exceeded') {
                            errors.push({ type: key, errorMessage: `max global expire time is ${Util.formatTime(+config.settings.MAX_GLOBAL_EXPIRE)}` });
                            break;
                        } else if (validTime === 'subceeded') {
                            errors.push({ type: key, errorMessage: `min global expire time is ${Util.formatTime(10800000)}` });
                            break;
                        } else if (validTime === 'invalid') {
                            errors.push({ type: key, errorMessage: 'invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.globalExpireTime === validTime) {
                            errors.push({ type: key, errorMessage: `global expire is already set to ${Util.formatTime(validTime)}` });
                        }
                    case 'promotion':
                        const promotionRole = Util.getRole(guild, value);

                        if (!promotionRole) {
                            errors.push({ type: key, errorMessage: 'can\'t find the given role' });
                            break;
                        }

                        if (BigInt(promotionRole.id) === guildSettings.promotionRole) {
                            errors.push({ type: key, errorMessage: 'the given role is already set as promotion role' });
                        }

                        if ([guildSettings.promotionRole, guildSettings.whitelistRole, guildSettings.blacklistRole].includes(BigInt(promotionRole.id))) {
                            errors.push({ type: key, errorMessage: 'can\'t use the same role twice in server settings' });
                            break;
                        }
                        break;
                    case 'whitelist':
                        const whitelistRole = Util.getRole(guild, value);

                        if (!whitelistRole) {
                            errors.push({ type: key, errorMessage: 'can\'t find the given role' });
                            break;
                        }

                        if (BigInt(whitelistRole.id) === guildSettings.whitelistRole) {
                            errors.push({ type: key, errorMessage: 'the given role is already set as whitelist role' });
                        }

                        if ([guildSettings.promotionRole, guildSettings.whitelistRole, guildSettings.blacklistRole].includes(BigInt(whitelistRole.id))) {
                            errors.push({ type: key, errorMessage: 'can\'t use the same role twice in server settings' });
                            break;
                        }
                        break;
                    case 'blacklist':
                        const blacklistRole = Util.getRole(guild, value);

                        if (!blacklistRole) {
                            errors.push({ type: key, errorMessage: 'can\'t find the given role' });
                            break;
                        }

                        if (BigInt(blacklistRole.id) === guildSettings.blacklistRole) {
                            errors.push({ type: key, errorMessage: 'the given role is already set as blacklist role' });
                        }

                        if ([guildSettings.promotionRole, guildSettings.whitelistRole, guildSettings.blacklistRole].includes(BigInt(blacklistRole.id))) {
                            errors.push({ type: key, errorMessage: 'can\'t use the same role twice in server settings' });
                            break;
                        }
                        break;
                    case 'server':
                        const validServer = await ServerModel.isServerStored(BigInt(guild.id), value);

                        if (!validServer) {
                            errors.push({ type: key, errorMessage: 'can\'t find the given server' });
                            break;
                        }

                        const serverId = await ServerModel.getServerIds(BigInt(guild.id), value);

                        if (serverId[0] === +guildSettings.defaultServer) {
                            errors.push({ type: key, errorMessage: `${value} is already set as default server` });
                            break;
                        }
                        break;
                    case 'start_message':
                    case 'sub_message':
                    case 'notify_message':
                        const toRespond = key.replace('_', ' ');

                        if (value.length > 150) {
                            errors.push({ type: key, errorMessage: `${toRespond} has to be shorter than 150 chars` });
                            break;
                        }

                        const propertyNames = {
                            start_message: 'startMessage',
                            sub_message: 'subMessage',
                            notify_message: 'notifyMessage'
                        }

                        if (guildSettings[propertyNames[key]] === value) {
                            errors.push({ type: key, errorMessage: `${toRespond} is already set to this value` });
                            break;
                        }
                        break;
                    case 'warn_streaks':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'amount has to be a number' });
                            break;
                        }

                        if (+value < 1 || +value > +config.settings.MAX_WARN_STREAKS) {
                            errors.push({ type: key, errorMessage: `warn streaks has to be a number between 1-${config.settings.MAX_WARN_STREAKS}` });
                            break;
                        }
                        break;
                    case 'warn_streak_expiration':
                    case 'warn_expiration':
                    case 'warn_bantime':
                        const values = {
                            warn_streak_expiration: [+config.settings.MAX_WARN_STREAK_EXPIRATION_TIME, 86400000, 'warnStreakExpiration'],
                            warn_expiration: [+config.settings.MAX_WARN_EXPIRATION_TIME, 7200000, 'warnExpiration'],
                            warn_bantime: [+config.settings.MAX_WARN_BANTIME, 3600000, 'warnBanTime']
                        }

                        const validTimeWarns = Util.validateTimeString(value, +values[key][0], +values[key][1]);

                        if (validTimeWarns === 'exceeded') {
                            errors.push({ type: key, errorMessage: `max ${key.replace('_', ' ')} time is ${Util.formatTime(+values[key][0])}` });
                            break;
                        } else if (validTimeWarns === 'subceeded') {
                            errors.push({ type: key, errorMessage: `min ${key.replace('_', ' ')} time is ${Util.formatTime(+values[key][1])}` });
                            break;
                        } else if (validTimeWarns === 'invalid') {
                            errors.push({ type: key, errorMessage: 'invalid time amounts given' });
                            break;
                        }

                        if (guildSettings[values[key][2]] === validTimeWarns) {
                            errors.push({ type: key, errorMessage: `warn ${key.replace('_', ' ')} time is already set to ${Util.formatTime(validTimeWarns)}` });
                            break;
                        }
                        break;
                    case 'warn_bantime_multiplier':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'amount has to be a number' });
                            break;
                        }

                        if (+value < 1 || +value > +config.settings.MAX_WARN_BANTIME_MULTIPLIER) {
                            errors.push({ type: key, errorMessage: `warn streak bantime multiplier has to be a number between 1-${config.settings.MAX_WARN_BANTIME_MULTIPLIER}` });
                            break;
                        }
                }
            }
            return errors;
        }
    }
}