import Discord from 'discord.js';
import PickupModel from "../models/pickup";
import Util from "./util";
import Bot from "./bot";
import { ValidationError, Command, PickupSettings } from './types';
import MappoolModel from '../models/mappool';
import ServerModel from '../models/server';
import GuildSettings from './guildSettings';
import ConfigTool from './configTool';
import { isArray } from 'util';

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
                            errors.push({ type: 'players', errorMessage: 'can\'t modify name when the pickup is active' });
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
                            teamCount = await (await PickupModel.getPickupSettings(BigInt(guild.id), pickup)).teamCount;
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
                            playerCount = await (await PickupModel.getPickupSettings(BigInt(guild.id), pickup)).playerCount;
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

                        if ([pickupSettings.blacklistRole ? pickupSettings.blacklistRole.toString() : null,
                        pickupSettings.promotionRole ? pickupSettings.promotionRole.toString() : null,
                        pickupSettings.captainRole ? pickupSettings.captainRole.toString() : null].includes(whitelistRole.id)) {
                            errors.push({ type: 'blacklist', errorMessage: 'can\'t set the same roles for different pickup specific roles' });
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

                        if ([pickupSettings.whitelistRole ? pickupSettings.whitelistRole.toString() : null,
                        pickupSettings.promotionRole ? pickupSettings.promotionRole.toString() : null,
                        pickupSettings.captainRole ? pickupSettings.captainRole.toString() : null].includes(blacklistRole.id)) {
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
                        if ([pickupSettings.blacklistRole ? pickupSettings.blacklistRole.toString() : null,
                        pickupSettings.whitelistRole ? pickupSettings.whitelistRole.toString() : null,
                        pickupSettings.captainRole ? pickupSettings.captainRole.toString() : null].includes(promotionRole.id)) {
                            errors.push({ type: 'blacklist', errorMessage: 'can\'t set the same roles for different pickup specific roles' });
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
                        if ([pickupSettings.blacklistRole ? pickupSettings.blacklistRole.toString() : null,
                        pickupSettings.promotionRole ? pickupSettings.promotionRole.toString() : null,
                        pickupSettings.whitelistRole ? pickupSettings.whitelistRole.toString() : null].includes(captainRole.id)) {
                            errors.push({ type: 'blacklist', errorMessage: 'can\'t set the same roles for different pickup specific roles' });
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

            if (isDuplicate && !doesExist.length) {
                return { type: 'exists', errorMessage: 'server not found' };
            }

            if (!isDuplicate && doesExist.length) {
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
            const validKeys = ['prefix', 'global_expire', 'trust_time', 'explicit_trust', 'whitelist', 'blacklist', 'promotion_delay', 'server',
                'start_message', 'sub_message', 'notify_message', 'iteration_time', 'afk_time', 'afk_check_iterations', 'picking_iterations', 'warn_streaks', 'warns_until_ban', 'warn_streak_expiration',
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
                        break;
                    case 'trust_time':
                        const validTrustTime = Util.validateTimeString(value, 1209600000, 900000);

                        if (validTrustTime === 'exceeded') {
                            errors.push({ type: key, errorMessage: `max trust time is ${Util.formatTime(1209600000)}` });
                            break;
                        } else if (validTrustTime === 'subceeded') {
                            errors.push({ type: key, errorMessage: `min trust time is ${Util.formatTime(900000)}` });
                            break;
                        } else if (validTrustTime === 'invalid') {
                            errors.push({ type: key, errorMessage: 'invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.trustTime === validTrustTime) {
                            errors.push({ type: key, errorMessage: `trust time is already set to ${Util.formatTime(validTrustTime)}` });
                        }
                        break;
                    case 'explicit_trust':
                        if (!['true', 'false'].includes(value)) {
                            errors.push({ type: key, errorMessage: 'value has to be true or false' });
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

                        if ([guildSettings.whitelistRole, guildSettings.blacklistRole].includes(BigInt(whitelistRole.id))) {
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

                        if ([guildSettings.whitelistRole, guildSettings.blacklistRole].includes(BigInt(blacklistRole.id))) {
                            errors.push({ type: key, errorMessage: 'can\'t use the same role twice in server settings' });
                            break;
                        }
                        break;
                    case 'promotion_delay':
                        const validPromotionDelay = Util.validateTimeString(value, 43200000, 300000);

                        if (validPromotionDelay === 'exceeded') {
                            errors.push({ type: key, errorMessage: `max promotion delay time is ${Util.formatTime(43200000)}` });
                            break;
                        } else if (validPromotionDelay === 'subceeded') {
                            errors.push({ type: key, errorMessage: `min promotion delay time is ${Util.formatTime(300000)}` });
                            break;
                        } else if (validPromotionDelay === 'invalid') {
                            errors.push({ type: key, errorMessage: 'invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.promotionDelay === validPromotionDelay) {
                            errors.push({ type: key, errorMessage: `promotion delay is already set to ${Util.formatTime(validPromotionDelay)}` });
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
                            errors.push({ type: key, errorMessage: `max iteration time is ${Util.formatTime(300000)}` });
                            break;
                        } else if (iterationTime === 'subceeded') {
                            errors.push({ type: key, errorMessage: `min iteration time is ${Util.formatTime(10000)}` });
                            break;
                        } else if (iterationTime === 'invalid') {
                            errors.push({ type: key, errorMessage: 'invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.iterationTime === iterationTime) {
                            errors.push({ type: key, errorMessage: `iteration time is already set to ${Util.formatTime(iterationTime)}` });
                        }
                        break;
                    case 'afk_time':
                        const afkTime = Util.validateTimeString(value, 21600000, 300000);

                        if (afkTime === 'exceeded') {
                            errors.push({ type: key, errorMessage: `max afk time is ${Util.formatTime(21600000)}` });
                            break;
                        } else if (afkTime === 'subceeded') {
                            errors.push({ type: key, errorMessage: `min afk time is ${Util.formatTime(300000)}` });
                            break;
                        } else if (afkTime === 'invalid') {
                            errors.push({ type: key, errorMessage: 'invalid time amounts given' });
                            break;
                        }

                        if (guildSettings.afkTime === afkTime) {
                            errors.push({ type: key, errorMessage: `afk time is already set to ${Util.formatTime(afkTime)}` });
                        }
                        break;
                    case 'afk_check_iterations':
                    case 'picking_iterations':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'amount has to be a number' });
                            break;
                        }

                        if (+value < 1 || +value > 5) {
                            errors.push({ type: key, errorMessage: `${key.replace('_', ' ')} has to be a number between 1-5` });
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
                        break;
                    case 'warns_until_ban':
                        if (!/^\d+$/.test(value)) {
                            errors.push({ type: key, errorMessage: 'amount has to be a number' });
                            break;
                        }
                        if (+value < 2 || +value > 10) {
                            errors.push({ type: key, errorMessage: `warns until ban has to be a number between 1-10` });
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
                    errors.push({ type: key, errorMessage: `unknown setting ${key}` });
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
                                errors.push({ type: key, errorMessage: 'amount has to be a number' });
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
                                errors.push({ type: key, errorMessage: `max ${def.name} time is ${Util.formatTime(maxTime)}` });
                                break;
                            } else if (timeVal === 'subceeded') {
                                errors.push({ type: key, errorMessage: `min ${def.name} time is ${Util.formatTime(minTime)}` });
                                break;
                            } else if (timeVal === 'invalid') {
                                errors.push({ type: key, errorMessage: 'invalid time amounts given' });
                                break;
                            }
                    }
                });
            }
            return errors;
        }
    }
}