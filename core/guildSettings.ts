import Discord from 'discord.js';
import { ChannelType, ValidationError, Command } from "./types";
import { Validator } from "./validator";
import GuildModel from '../models/guild';
import Util from './util';
import ServerModel from '../models/server';

// Only storing frequently accessed data and sync with db
export default class GuildSettings {
    pendingPickups = new Map();

    constructor(
        private guild: Discord.Guild,
        private _id: bigint,
        private _prefix: string,
        private _blacklistRole: bigint,
        private _whitelistRole: bigint,
        private _promotionDelay: number,
        private _lastPromote: Date | null,
        private _globalExpireTime: number | null,
        private _trustTime: number,
        private _disabledCommands: string[],
        private _commandSettings: Map<string, any[]>,
        private _channels: Map<bigint, ChannelType>,
        private _defaultServer: number,
        private _startMessage: string,
        private _subMessage: string,
        private _notifyMessage: string,
        private _iterationTime: number,
        private _afkTime: number,
        private _afkCheckIterations: number,
        private _pickingIterations: number,
        private _warnStreaks: number,
        private _warnsUntilBan: number,
        private _warnStreakExpiration: number,
        private _warnExpiration: number,
        private _warnBanTime: number,
        private _warnBanTimeMultiplier: number) {
    }

    public async modifyProperty(...properties: { key: string, value: string }[]): Promise<ValidationError[]> {
        // Check if all given properties are valid
        const errors: ValidationError[] = [];
        for (const prop of properties) {

            if (prop.value === 'none') {
                if (['prefix', 'warn_streaks', 'iteration_time', 'afk_time', 'afk_check_iterations', 'picking_iterations', 'warn_streak_expiration',
                    'warn_expiration', 'warn_bantime', 'warn_bantime_multiplier', 'warns_until_ban'].includes(prop.key)) {
                    errors.push({ type: 'none', errorMessage: `you can't disable property ${prop.key}` });
                } else {
                    continue;
                }
            }

            if (Validator.Guild.areValidKeys(prop.key).length) {
                errors.push({ type: 'invalidKey', errorMessage: `unknown setting ${prop.key}` });
            }

            const isValid = await Validator.Guild.validate(this.guild, this, prop);
            if (isValid.length) {
                errors.push(isValid[0]);
            }
        }

        // Do not continue after errors
        if (errors.length) {
            return errors;
        }

        const dbColumnNames = ['global_whitelist_role', 'global_blacklist_role',
            'server_id', 'warn_ban_time', 'warn_ban_time_multiplier', 'warn_expiration_time']
        const keyNames = ['whitelist', 'blacklist', 'server', 'warn_bantime',
            'warn_bantime_multiplier', 'warn_expiration'];

        for (const property of properties) {
            const key = property.key;
            let value = property.value;
            let dbColumn = keyNames.includes(key) ? dbColumnNames[keyNames.indexOf(key)] : key;

            // Convert to ms if required
            if (['global_expire', 'promotion_delay', 'afk_time', 'warn_bantime', 'warn_expiration', 'warn_streak_expiration'].includes(key)) {
                value = (Util.timeStringToTime(value) * 60 * 1000).toString();
            }

            // Special case for iteration time which can be in seconds
            if (['iteration_time'].includes(key)) {
                value = (Util.timeStringToTime(value, true) * 1000).toString();
            }

            // Get the role ids
            if (value !== 'none' && ['whitelist', 'blacklist'].includes(key)) {
                value = Util.getRole(this.guild, value).id;
            }

            // Server
            if (key === 'server') {
                value = await (await ServerModel.getServerIds(BigInt(this.id), value))[0];
            }

            if (value === 'none') {
                value = null;
            }

            await GuildModel.modifyGuild(this.id, dbColumn, value);

            switch (key) {
                case 'prefix': this._prefix = value; break;
                case 'global_expire': this._globalExpireTime = value ? +value : null; break;
                case 'whitelist': this._whitelistRole = value ? BigInt(value) : null; break;
                case 'blacklist': this._blacklistRole = value ? BigInt(value) : null; break;
                case 'promotion_delay': this._promotionDelay = value ? +value : null; break;
                case 'server': this._defaultServer = value ? +value : null; break;
                case 'start_message': this._startMessage = value; break;
                case 'sub_message': this._subMessage = value; break;
                case 'notify_message': this._notifyMessage = value; break;
                case 'iteration_time': this._iterationTime = +value; break;
                case 'afk_time': this._afkTime = +value; break;
                case 'afk_check_iterations': this._afkCheckIterations = +value; break;
                case 'picking_iterations': this._pickingIterations = +value; break;
                case 'warn_streaks': this._warnStreaks = value ? +value : null; break;
                case 'warns_until_ban': this._warnsUntilBan = value ? +value : null; break;
                case 'warn_streak_expiration': this._warnStreakExpiration = +value; break;
                case 'warn_expiration': this._warnExpiration = +value; break;
                case 'warn_bantime': this._warnBanTime = +value; break;
                case 'warn_bantime_multiplier': this._warnBanTimeMultiplier = +value; break;
            }
        }

        return errors;
    }

    public async modifyCommand(command: Command, valueArr) {
        await GuildModel.modifyCommand(this.id, [{ command: command.cmd, values: valueArr }])
        this._commandSettings.set(command.cmd, valueArr);
    }

    public async disableCommand(...commands) {
        await GuildModel.disableCommand(this.id, ...commands);
        this._disabledCommands.push(...commands);
    }

    public async enableCommand(...commands) {
        await GuildModel.enableCommand(this.id, ...commands);
        this._disabledCommands = this._disabledCommands.filter(cmd => !commands.includes(cmd));
    }

    public updateLastPromote() {
        this._lastPromote = new Date();
    }

    public get channels(): Map<bigint, ChannelType> {
        return this._channels;
    }

    public get commandSettings(): Map<string, any> {
        return this._commandSettings;
    }

    public get disabledCommands(): string[] {
        return this._disabledCommands;
    }

    public get trustTime(): number {
        return this._trustTime;
    }

    public get globalExpireTime(): number {
        return this._globalExpireTime;
    }

    public get promotionDelay(): number {
        return this._promotionDelay;
    }

    public get lastPromote(): Date | null {
        return this._lastPromote;
    }

    public get whitelistRole(): bigint {
        return this._whitelistRole;
    }

    public get blacklistRole(): bigint {
        return this._blacklistRole;
    }

    public get prefix(): string {
        return this._prefix;
    }

    public get id(): bigint {
        return this._id;
    }

    public get pickingIterations(): number {
        return this._pickingIterations;
    }
    public get afkCheckIterations(): number {
        return this._afkCheckIterations;
    }
    public get iterationTime(): number {
        return this._iterationTime;
    }

    public get afkTime(): number {
        return this._afkTime;
    }

    public get warnBanTimeMultiplier(): number {
        return this._warnBanTimeMultiplier;
    }

    public get warnsUntilBan(): number {
        return this._warnsUntilBan;
    }

    public get warnExpiration(): number {
        return this._warnExpiration;
    }

    public get warnBanTime(): number {
        return this._warnBanTime;
    }

    public get warnStreakExpiration(): number {
        return this._warnStreakExpiration;
    }

    public get warnStreaks(): number {
        return this._warnStreaks;
    }

    public get notifyMessage(): string {
        return this._notifyMessage;
    }

    public get subMessage(): string {
        return this._subMessage;
    }

    public get startMessage(): string {
        return this._startMessage;
    }

    public get defaultServer(): number {
        return this._defaultServer;
    }
}