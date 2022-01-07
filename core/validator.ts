import Discord from 'discord.js';
import PickupModel from "../models/pickup";
import Util from "./util";
import { ValidationError, Command, PickupSettings } from './types';
import MappoolModel from '../models/mappool';
import ServerModel from '../models/server';
import GuildSettings from './guildSettings';
import ConfigTool from './configTool';

const config = ConfigTool.getConfig();

export namespace Validator {
    export namespace Pickup {
        export function areValidKeys(...keys) {
            const validKeys = ['name', 'enabled', 'players', 'teams', 'default', 'mappool', 'mapvote', 'afkcheck', 'captain_selection',
                'pickmode', 'rated', 'max_rank_rating_cap', 'allowlist', 'denylist', 'promotion', 'captain', 'server', 'max_rank_rating_cap'];
            const invalidKeys = keys.filter(key => !validKeys.includes(key));

            return invalidKeys;
        };

        export async function isValidPickup(guildId: bigint, pickup: string, isDuplicate = true) {
            const doesExist = await PickupModel.areValidPickups(guildId, false, pickup);

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
            let pickupSettings: PickupSettings;
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
                            errors.push({ type: 'players', errorMessage: 'Can\'t modify name when the pickup is active' });
                        }

                        if (!/^[a-zA-Z0-9]+$/.test(value)) {
                            errors.push({ type: 'name', errorMessage: 'Invalid pickup name, has to be alphanumeric only' });
                            break;
                        }

                        if (value.length > 20 || value.length === 0) {
                            errors.push({ type: 'name', errorMessage: 'Pickup name must be between 1-20 chars long' });
                            break;
                        }
                        break;
                    case 'enabled':
                        if (!['true', 'false'].includes(value)) {
                            errors.push({ type: 'default', errorMessage: 'Value has to be true or false' });
                            break;
                        }

                        if (!isPickupActive) {
                            isPickupActive = await (await PickupModel.getActivePickups(BigInt(guild.id))).has(pickup as string);
                        }

                        if (isPickupActive) {
                            errors.push({ type: 'players', errorMessage: 'Can\'t disable pickups with queued up players' });
                        }
                        break;
                    case 'players':
                        if (!isPickupActive) {
                            isPickupActive = await (await PickupModel.getActivePickups(BigInt(guild.id))).has(pickup as string);
                        }

                        if (isPickupActive) {
                            errors.push({ type: 'players', errorMessage: 'Can\'t modify players when the pickup is active' });
                        }

                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: 'players', errorMessage: 'Amount has to be a number' });
                            break;
                        }

                        if (!(value.length <= 3 && +value >= 2 && +value <= 100)) {
                            errors.push({ type: 'players', errorMessage: 'Player count has to be in the range of 2 and 100' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if (+value % pickupSettings.teamCount !== 0) {
                            errors.push({ type: 'players', errorMessage: `Can't create even teams with the given player count (players: ${value} teams: ${pickupSettings.teamCount})` });
                            break;
                        }
                        break;
                    case 'teams':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: 'teams', errorMessage: 'Amount has to be a number' });
                            break;
                        }

                        if (!(value.length <= 2 && +value >= 2 && +value <= 10)) {
                            errors.push({ type: 'teams', errorMessage: 'Team count has to be in a range of 2 and 10' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if (pickupSettings.playerCount % +value !== 0) {
                            errors.push({ type: 'teams', errorMessage: `Can't create even teams with the given team count (players: ${pickupSettings.playerCount} teams: ${value})` });
                            break;
                        }
                        break;
                    case 'default':
                        if (!['true', 'false'].includes(value)) {
                            errors.push({ type: 'default', errorMessage: 'Value has to be true or false' });
                            break;
                        }
                        break;
                    case 'mappool':
                        const validPool = await MappoolModel.isMappoolStored(BigInt(guild.id), value);

                        if (!validPool) {
                            errors.push({ type: 'mappool', errorMessage: 'Given map pool not found' });
                            break;
                        }
                        break;
                    case 'mapvote':
                        if (!['true', 'false'].includes(value)) {
                            errors.push({ type: 'mapvote', errorMessage: 'Value has to be true or false' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if ((pickupSettings.mapvote ? 'true' : 'false') === value.toLowerCase()) {
                            errors.push({ type: 'mappool', errorMessage: `Map voting is already ${pickupSettings.mapvote ? 'enabled' : 'disabled'} for pickup ${pickupSettings.name}` });
                            break;
                        }

                        if (!pickupSettings.mapPoolId) {
                            errors.push({ type: 'mappool', errorMessage: 'There has to be a map pool assigned to the pickup with at least two maps' });
                            break;
                        }

                        const poolName = await MappoolModel.getPoolName(BigInt(guild.id), pickupSettings.mapPoolId);
                        const mapPool = await MappoolModel.getMaps(BigInt(guild.id), poolName);

                        if (mapPool.length < 2) {
                            errors.push({ type: 'mappool', errorMessage: `Map pool ${poolName} for pickup ${pickupSettings.name} only contains one map, two or more required for voting` });
                            break;
                        }
                        break;
                    case 'afkcheck':
                        if (!['true', 'false'].includes(value)) {
                            errors.push({ type: 'afkcheck', errorMessage: 'Value has to be true or false' });
                            break;
                        }
                        break;
                    case 'captain_selection':
                        if (!['manual', 'auto'].includes(value)) {
                            errors.push({ type: 'captain_selection', errorMessage: 'Value has to be manual or auto' });
                            break;
                        }
                        break;
                    case 'pickmode':
                        if (!['no_teams', 'manual', 'random', 'elo', 'autopick'].includes(value)) {
                            errors.push({ type: 'pickmode', errorMessage: 'Value has to be no_teams, manual, random or elo' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if (value.toLocaleLowerCase() === 'no_teams' && pickupSettings.rated) {
                            errors.push({ type: 'pickmode', errorMessage: 'Value no_teams is invalid for pickups in rated mode, disable rated mode first' });
                            break;
                        }

                        if ((pickupSettings.playerCount / pickupSettings.teamCount) < 2 && ['manual', 'random', 'elo'].includes(value)) {
                            errors.push({ type: 'pickmode', errorMessage: `Can't use ${value.toLowerCase()} pick mode for a pickup with one player teams` });
                            break;
                        }

                        if (pickupSettings.playerCount > 20 && ['manual', 'autopick'].includes(value)) {
                            errors.push({ type: 'pickmode', errorMessage: 'Manual or autopick mode is only available for pickups with up to 20 players' });
                            break;
                        }

                        break;
                    case 'rated':
                        if (!['true', 'false'].includes(value)) {
                            errors.push({ type: 'rated', errorMessage: 'Value has to be true or false' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if ((pickupSettings.playerCount / pickupSettings.teamCount) > 1 && pickupSettings.pickMode === 'no_teams') {
                            errors.push({ type: 'rated', errorMessage: 'Pickup has to be in manual, random, elo or autopick picking mode to be rateable' });
                            break;
                        }
                        break;
                    case 'max_rank_rating_cap':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'Amount has to be a number' });
                            break;
                        }

                        if (+value < Util.tsToEloNumber(10) || +value > Util.tsToEloNumber(50)) {
                            errors.push({ type: key, errorMessage: `${key.replace('_', ' ')} has to be a number between ${Util.tsToEloNumber(10)} and ${Util.tsToEloNumber(50)}` });
                            break;
                        }
                        break;
                    case 'allowlist':
                        const allowlistRole = Util.getRole(guild, value);

                        if (!allowlistRole) {
                            errors.push({ type: 'allowlist', errorMessage: 'Can\'t find the given role' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if ([pickupSettings.denylistRole ? pickupSettings.denylistRole.toString() : null,
                        pickupSettings.promotionRole ? pickupSettings.promotionRole.toString() : null,
                        pickupSettings.captainRole ? pickupSettings.captainRole.toString() : null].includes(allowlistRole.id)) {
                            errors.push({ type: 'denylist', errorMessage: 'Can\'t set the same roles for different pickup specific roles' });
                            break;
                        }
                        break;
                    case 'denylist':
                        const denylistRole = Util.getRole(guild, value);

                        if (!denylistRole) {
                            errors.push({ type: 'denylist', errorMessage: 'Can\'t find the given role' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }

                        if ([pickupSettings.allowlistRole ? pickupSettings.allowlistRole.toString() : null,
                        pickupSettings.promotionRole ? pickupSettings.promotionRole.toString() : null,
                        pickupSettings.captainRole ? pickupSettings.captainRole.toString() : null].includes(denylistRole.id)) {
                            errors.push({ type: 'denylist', errorMessage: 'Can\'t set the same roles for different pickup specific roles' });
                            break;
                        }
                        break;
                    case 'promotion':
                        const promotionRole = Util.getRole(guild, value);

                        if (!promotionRole) {
                            errors.push({ type: 'promotion', errorMessage: 'Can\'t find the given role' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }
                        if ([pickupSettings.denylistRole ? pickupSettings.denylistRole.toString() : null,
                        pickupSettings.allowlistRole ? pickupSettings.allowlistRole.toString() : null,
                        pickupSettings.captainRole ? pickupSettings.captainRole.toString() : null].includes(promotionRole.id)) {
                            errors.push({ type: 'denylist', errorMessage: 'Can\'t set the same roles for different pickup specific roles' });
                            break;
                        }
                        break;
                    case 'captain':
                        const captainRole = Util.getRole(guild, value);

                        if (!captainRole) {
                            errors.push({ type: 'captain', errorMessage: 'Can\'t find the given role' });
                            break;
                        }

                        if (!pickupSettings) {
                            pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup);
                        }
                        if ([pickupSettings.denylistRole ? pickupSettings.denylistRole.toString() : null,
                        pickupSettings.promotionRole ? pickupSettings.promotionRole.toString() : null,
                        pickupSettings.allowlistRole ? pickupSettings.allowlistRole.toString() : null].includes(captainRole.id)) {
                            errors.push({ type: 'denylist', errorMessage: 'Can\'t set the same roles for different pickup specific roles' });
                            break;
                        }
                        break;
                    case 'server':
                        const validServer = await ServerModel.isServerStored(BigInt(guild.id), value);

                        if (!validServer) {
                            errors.push({ type: 'server', errorMessage: 'Can\'t find the given server' });
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
            const guildPools = await MappoolModel.getPools(guildId);

            if (guildPools.length >= 50) {
                return { type: 'exceeded', errorMessage: 'Already reached max stored map pools capacity of 50, remove pools to add more' };
            }

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
            const guildServers = await ServerModel.getServers(guildId);

            if (guildServers.length >= 50) {
                return { type: 'exceeded', errorMessage: 'Already reached max stored server capacity of 50, remove servers to add more' };
            }

            const doesExist = await ServerModel.isServerStored(guildId, name);

            if (isDuplicate && !doesExist.length) {
                return { type: 'exists', errorMessage: 'Server not found' };
            }

            if (!isDuplicate && doesExist.length) {
                return { type: 'exists', errorMessage: 'Server already stored' };
            }

            if (!/^[a-zA-Z0-9]+$/.test(name)) {
                return { type: 'name', errorMessage: 'Invalid server name, has to be alphanumeric only' };
            }

            if (name.length > 45 || name.length === 0) {
                return { type: 'name', errorMessage: 'Server name must be between 1-45 chars long' };
            }

            return true;
        }

        export function isValidIp(ip) {
            if (ip.length > 45 || ip.length === 0) {
                return { type: 'ip', errorMessage: 'IP must be between 1-45 chars long' };
            }
            return true;
        }

        export function isValidPassword(ip) {
            if (ip.length > 45 || ip.length === 0) {
                return { type: 'password', errorMessage: 'Password must be between 1-45 chars long' };
            }
            return true;
        }
    }

    export namespace Guild {
        export function areValidKeys(...keys) {
            const validKeys = ['prefix', 'global_expire', 'report_expire', 'trust_time', 'explicit_trust', 'allowlist', 'denylist', 'pickup_player', 'promotion_delay', 'server',
                'start_message', 'sub_message', 'notify_message', 'iteration_time', 'afk_time', 'afk_check_iterations', 'picking_iterations', 'map_vote_iterations', 'max_avg_elo_variance',
                'warn_streaks', 'warns_until_ban', 'warn_streak_expiration', 'warn_expiration', 'warn_bantime', 'warn_bantime_multiplier', 'captain_selection_iterations', 'max_rank_rating_cap'];

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
                            errors.push({ type: key, errorMessage: 'Prefix must be between 1-3 chars long' });
                            break;
                        }

                        const currentPrefix = guildSettings.prefix;

                        if (currentPrefix === value) {
                            errors.push({ type: key, errorMessage: `Prefix is already set to ${value}` });
                            break;
                        }
                        break;
                    case 'global_expire':
                        const validTime = Util.validateTimeString(value, +config.settings.MAX_GLOBAL_EXPIRE, 10800000);

                        if (validTime === 'exceeded') {
                            errors.push({ type: key, errorMessage: `Max global expire time is ${Util.formatTime(+config.settings.MAX_GLOBAL_EXPIRE)}` });
                            break;
                        } else if (validTime === 'subceeded') {
                            errors.push({ type: key, errorMessage: `Min global expire time is ${Util.formatTime(10800000)}` });
                            break;
                        } else if (validTime === 'invalid') {
                            errors.push({ type: key, errorMessage: 'Invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.globalExpireTime === validTime) {
                            errors.push({ type: key, errorMessage: `Global expire is already set to ${Util.formatTime(validTime)}` });
                        }
                        break;
                    case 'report_expire':
                        const validReportExpireTime = Util.validateTimeString(value, 86400000, 1800000);

                        if (validReportExpireTime === 'exceeded') {
                            errors.push({ type: key, errorMessage: `Max report expire time is ${Util.formatTime(86400000)}` });
                            break;
                        } else if (validReportExpireTime === 'subceeded') {
                            errors.push({ type: key, errorMessage: `Min report expire time is ${Util.formatTime(1800000)}` });
                            break;
                        } else if (validReportExpireTime === 'invalid') {
                            errors.push({ type: key, errorMessage: 'Invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.trustTime === validReportExpireTime) {
                            errors.push({ type: key, errorMessage: `Report expire time is already set to ${Util.formatTime(validReportExpireTime)}` });
                        }
                        break;
                    case 'trust_time':
                        const validTrustTime = Util.validateTimeString(value, 1209600000, 900000);

                        if (validTrustTime === 'exceeded') {
                            errors.push({ type: key, errorMessage: `Max trust time is ${Util.formatTime(1209600000)}` });
                            break;
                        } else if (validTrustTime === 'subceeded') {
                            errors.push({ type: key, errorMessage: `Min trust time is ${Util.formatTime(900000)}` });
                            break;
                        } else if (validTrustTime === 'invalid') {
                            errors.push({ type: key, errorMessage: 'Invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.trustTime === validTrustTime) {
                            errors.push({ type: key, errorMessage: `Trust time is already set to ${Util.formatTime(validTrustTime)}` });
                        }
                        break;
                    case 'explicit_trust':
                        if (!['true', 'false'].includes(value)) {
                            errors.push({ type: key, errorMessage: 'Value has to be true or false' });
                            break;
                        }
                        break;
                    case 'allowlist':
                        const allowlistRole = Util.getRole(guild, value);

                        if (!allowlistRole) {
                            errors.push({ type: key, errorMessage: 'Can\'t find the given role' });
                            break;
                        }

                        if (BigInt(allowlistRole.id) === guildSettings.allowlistRole) {
                            errors.push({ type: key, errorMessage: 'The given role is already set as allowlist role' });
                        }

                        if ([guildSettings.allowlistRole, guildSettings.denylistRole].includes(BigInt(allowlistRole.id))) {
                            errors.push({ type: key, errorMessage: 'Can\'t use the same role twice in server settings' });
                            break;
                        }
                        break;
                    case 'denylist':
                        const denylistRole = Util.getRole(guild, value);

                        if (!denylistRole) {
                            errors.push({ type: key, errorMessage: 'Can\'t find the given role' });
                            break;
                        }

                        if (BigInt(denylistRole.id) === guildSettings.denylistRole) {
                            errors.push({ type: key, errorMessage: 'The given role is already set as denylist role' });
                        }

                        if ([guildSettings.allowlistRole, guildSettings.denylistRole].includes(BigInt(denylistRole.id))) {
                            errors.push({ type: key, errorMessage: 'Can\'t use the same role twice in server settings' });
                            break;
                        }
                        break;
                    case 'pickup_player':
                        const pickupPlayerRole = Util.getRole(guild, value);

                        if (!pickupPlayerRole) {
                            errors.push({ type: key, errorMessage: 'Can\'t find the given role' });
                            break;
                        }
                        break;
                    case 'promotion_delay':
                        const validPromotionDelay = Util.validateTimeString(value, 43200000, 300000);

                        if (validPromotionDelay === 'exceeded') {
                            errors.push({ type: key, errorMessage: `Max promotion delay time is ${Util.formatTime(43200000)}` });
                            break;
                        } else if (validPromotionDelay === 'subceeded') {
                            errors.push({ type: key, errorMessage: `Min promotion delay time is ${Util.formatTime(300000)}` });
                            break;
                        } else if (validPromotionDelay === 'invalid') {
                            errors.push({ type: key, errorMessage: 'Invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.promotionDelay === validPromotionDelay) {
                            errors.push({ type: key, errorMessage: `Promotion delay is already set to ${Util.formatTime(validPromotionDelay)}` });
                        }
                        break;
                    case 'server':
                        const validServer = await ServerModel.isServerStored(BigInt(guild.id), value);

                        if (!validServer) {
                            errors.push({ type: key, errorMessage: 'Can\'t find the given server' });
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

                        if (value.length > 200) {
                            errors.push({ type: key, errorMessage: `${toRespond} has to be shorter than 200 chars` });
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
                    case 'iteration_time':
                        const iterationTime = Util.validateTimeString(value, 300000, 10000, true);

                        if (iterationTime === 'exceeded') {
                            errors.push({ type: key, errorMessage: `Max iteration time is ${Util.formatTime(300000)}` });
                            break;
                        } else if (iterationTime === 'subceeded') {
                            errors.push({ type: key, errorMessage: `Min iteration time is ${Util.formatTime(10000)}` });
                            break;
                        } else if (iterationTime === 'invalid') {
                            errors.push({ type: key, errorMessage: 'Invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.iterationTime === iterationTime) {
                            errors.push({ type: key, errorMessage: `Iteration time is already set to ${Util.formatTime(iterationTime)}` });
                        }
                        break;
                    case 'afk_time':
                        const afkTime = Util.validateTimeString(value, 21600000, 300000);

                        if (afkTime === 'exceeded') {
                            errors.push({ type: key, errorMessage: `Max afk time is ${Util.formatTime(21600000)}` });
                            break;
                        } else if (afkTime === 'subceeded') {
                            errors.push({ type: key, errorMessage: `Min afk time is ${Util.formatTime(300000)}` });
                            break;
                        } else if (afkTime === 'invalid') {
                            errors.push({ type: key, errorMessage: 'Invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.afkTime === afkTime) {
                            errors.push({ type: key, errorMessage: `Afk time is already set to ${Util.formatTime(afkTime)}` });
                        }
                        break;
                    case 'afk_check_iterations':
                    case 'picking_iterations':
                    case 'map_vote_iterations':
                    case 'captain_selection_iterations':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'amount has to be a number' });
                            break;
                        }

                        if (+value < 1 || +value > 5) {
                            errors.push({ type: key, errorMessage: `${key.replace('_', ' ')} has to be a number between 1-5` });
                            break;
                        }
                        break;
                    case 'max_avg_elo_variance':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'Amount has to be a number' });
                            break;
                        }

                        // max variance = mu / sigma
                        if (+value < Util.tsToEloNumber(1) || +value > Util.tsToEloNumber(25 / 3)) {
                            errors.push({ type: key, errorMessage: `${key.replace('_', ' ')} has to be a number between ${Util.tsToEloNumber(1)} and ${Util.tsToEloNumber(25 / 3)}` });
                            break;
                        }

                        if (guildSettings.maxAvgVariance === +value) {
                            errors.push({ type: key, errorMessage: `Max average elo variance is already set to ${Util.tsToEloNumber(+value)}` });
                        }
                        break;
                    case 'max_rank_rating_cap':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'Amount has to be a number' });
                            break;
                        }

                        if (+value < Util.tsToEloNumber(10) || +value > Util.tsToEloNumber(50)) {
                            errors.push({ type: key, errorMessage: `${key.replace('_', ' ')} has to be a number between ${Util.tsToEloNumber(10)} and ${Util.tsToEloNumber(50)}` });
                            break;
                        }
                        break;
                    case 'warn_streaks':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'Amount has to be a number' });
                            break;
                        }

                        if (+value < 1 || +value > +config.settings.MAX_WARN_STREAKS) {
                            errors.push({ type: key, errorMessage: `Warn streaks has to be a number between 1-${config.settings.MAX_WARN_STREAKS}` });
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
                            errors.push({ type: key, errorMessage: `Max ${key.replace('_', ' ')} time is ${Util.formatTime(+values[key][0])}` });
                            break;
                        } else if (validTimeWarns === 'subceeded') {
                            errors.push({ type: key, errorMessage: `Min ${key.replace('_', ' ')} time is ${Util.formatTime(+values[key][1])}` });
                            break;
                        } else if (validTimeWarns === 'invalid') {
                            errors.push({ type: key, errorMessage: 'Invalid time amounts given' });
                            break;
                        }

                        if (guildSettings[values[key][2]] === validTimeWarns) {
                            errors.push({ type: key, errorMessage: `Warn ${key.replace('_', ' ')} time is already set to ${Util.formatTime(validTimeWarns)}` });
                            break;
                        }
                        break;
                    case 'warn_bantime_multiplier':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'Amount has to be a number' });
                            break;
                        }

                        if (+value < 1 || +value > +config.settings.MAX_WARN_BANTIME_MULTIPLIER) {
                            errors.push({ type: key, errorMessage: `Warn streak bantime multiplier has to be a number between 1-${config.settings.MAX_WARN_BANTIME_MULTIPLIER}` });
                            break;
                        }
                        break;
                    case 'warns_until_ban':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'Amount has to be a number' });
                            break;
                        }
                        if (+value < 2 || +value > 10) {
                            errors.push({ type: key, errorMessage: `Warns until ban has to be a number between 1-10` });
                        }
                }
            }
            return errors;
        }
    }

    export namespace CommandOption {
        export function areValidOptions(command: Command, ...options) {
            return options.filter(option => !command.defaults.includes(option));
        }

        export function validate(guildSettings: GuildSettings, ...toValidate: { command: Command, key: string, value: string }[]) {
            let errors: ValidationError[] = [];

            for (const obj of toValidate) {
                let command = obj.command;
                let key = obj.key;
                let value = obj.value;

                if (!command.defaults.map(def => def.name).includes(key)) {
                    errors.push({ type: key, errorMessage: `Unknown property ${key}` });
                }

                command.defaults.forEach(def => {
                    switch (def.type) {
                        case 'string':
                            // @ts-ignore
                            if (!def.possibleValues.includes(value)) {
                                // @ts-ignore
                                errors.push({ type: key, errorMessage: `${value} is not a valid value for ${key}, values: ${def.possibleValues.join(', ')}` })
                                break;
                            }
                            break;
                        case 'number':
                            if (!/^\d+$/.test(value)) {
                                errors.push({ type: key, errorMessage: 'Amount has to be a number' });
                                break;
                            }

                            if (Array.isArray(def.possibleValues)) {
                                if (!(def.possibleValues as number[]).includes(+value)) {
                                    errors.push({ type: key, errorMessage: `${value} is not a valid value for ${key}, value has to be ${def.possibleValues.join(', ')}` });
                                }
                            } else {
                                if (def.possibleValues.from > +value || def.possibleValues.to < +value) {
                                    errors.push({ type: key, errorMessage: `${key} has to be in the range of ${def.possibleValues.from}-${def.possibleValues.to}` });
                                }
                            }
                            break;
                        case 'time':
                            // @ts-ignore - properties always available in this case
                            const maxTime = def.possibleValues.to;
                            // @ts-ignore
                            const minTime = def.possibleValues.from;

                            const timeVal = Util.validateTimeString(value, maxTime, minTime);

                            if (timeVal === 'exceeded') {
                                errors.push({ type: key, errorMessage: `Max ${def.name} time is ${Util.formatTime(maxTime)}` });
                                break;
                            } else if (timeVal === 'subceeded') {
                                errors.push({ type: key, errorMessage: `Min ${def.name} time is ${Util.formatTime(minTime)}` });
                                break;
                            } else if (timeVal === 'invalid') {
                                errors.push({ type: key, errorMessage: 'Invalid time amounts given' });
                                break;
                            }
                    }
                });
            }
            return errors;
        }
    }
}