import Discord from 'discord.js';
import PickupModel from "../models/pickup";
import Util from "./util";
import Bot from "./bot";
import { ValidationError } from './types';

const bot = Bot.getInstance();

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
                        // TODO  
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
                        // TODO
                        break;
                }
            }

            return errors;
        }
    }
}