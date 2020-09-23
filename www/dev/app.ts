import { Socket } from 'socket.io-client';

export default class DevApp {
    private guilds: Map<string, GuildData> = new Map();
    private client: SocketIOClient.Socket = io();

    // DOM refs
    private activeGuildRef: HTMLDivElement;
    private activeFakeUserRef: HTMLDivElement;
    private consoleContentEl = document.getElementById('console');
    private guildsListEl = document.getElementById('guilds');
    private fakePlayersListEl = document.getElementById('fake-players');
    private pickupListEl = document.getElementById('pickups');
    private pickupBoxEl = document.getElementById('pickup-box');
    private createFakeUserBtnEl = document.getElementById('create-user');
    private removeFakeUserBtnEl = document.getElementById('remove-user');
    private reloadPickupsBtnEl = document.getElementById('reload-pickups');
    private offlineEventBtnEl = document.getElementById('offline');
    private memberRemoveEventBtnEl = document.getElementById('member-remove');

    private currentGuildId: string;
    private currentFakePlayer: { id: string; name: string };


    constructor() {
        this.eventHandler();
        this.client.emit('init');

        this.reloadPickupsBtnEl.addEventListener('click', () => {
            this.client.emit('get-guild', this.currentGuildId);
            this.renderPickups(this.currentGuildId);
        });

        this.createFakeUserBtnEl.addEventListener('click', () => {
            this.writeToConsole('Created fake player');
            this.client.emit('create-user', this.currentGuildId);
        });

        this.removeFakeUserBtnEl.addEventListener('click', () => {
            if (!this.guilds.get(this.currentGuildId).fakeUsers.length) {
                return this.writeToConsole('There are no fake players to remove left');
            }

            this.writeToConsole('Removed fake player');
            this.client.emit('remove-user', this.currentGuildId);
        });

        this.offlineEventBtnEl.addEventListener('click', () => {
            if (!this.currentFakePlayer) {
                return this.writeToConsole('No fake player selected for event triggering');
            }

            this.client.emit('offline-event', JSON.stringify({
                guild: this.currentGuildId,
                player: this.currentFakePlayer
            }));

            this.writeToConsole(`Triggered offline presence event for ${this.currentFakePlayer.name}`);
        });

        this.memberRemoveEventBtnEl.addEventListener('click', () => {
            if (!this.currentFakePlayer) {
                return this.writeToConsole('No fake player selected for event triggering');
            }

            this.client.emit('remove-event', JSON.stringify({
                guild: this.currentGuildId,
                player: this.currentFakePlayer
            }));

            this.writeToConsole(`Triggered member remove event for ${this.currentFakePlayer.name}`);
        });
    }

    private eventHandler() {
        this.client.on('init-data', data => this.initData(data));
        this.client.on('guild-update', data => this.updateGuild(data));
    }

    private initData(jsonString: string) {
        const convertedData = JSON.parse(jsonString) as GuildData[];

        convertedData.forEach(guild => {
            this.guilds.set(guild.id, guild);
        });

        this.writeToConsole(`Received information of ${convertedData.length} guild${convertedData.length > 0 ? 's' : ''}`);
        this.initGuildList();
    }

    private initGuildList() {
        const guildInfo = Array.from(this.guilds.values())
            .map(guild => {
                return {
                    id: guild.id,
                    name: guild.name
                }
            });

        guildInfo.forEach(guild => {
            const guildInfoContainerEl = document.createElement('div');
            guildInfoContainerEl.className = 'guilds__guild';
            guildInfoContainerEl.innerHTML = `
        <div>${guild.name}</div>
        <div>${guild.id}</div>
        `;

            guildInfoContainerEl.addEventListener('click', () => {
                if (this.activeGuildRef) {
                    this.activeGuildRef.classList.toggle('active');
                }

                this.activeGuildRef = guildInfoContainerEl;
                this.activeGuildRef.classList.toggle('active');

                this.loadGuild(guild.id);
            });

            this.guildsListEl.appendChild(guildInfoContainerEl);
        });
    }

    private loadGuild(guildId: string) {
        this.currentGuildId = guildId;

        this.renderFakePlayers(guildId);
        this.renderPickups(guildId);
        this.renderPickupBox(guildId);

        const fakePlayerEventsBoxEl = document.getElementById('fake-player-events');
        fakePlayerEventsBoxEl.classList.remove('hidden');

        this.currentFakePlayer = null;
        document.getElementById('event-player').textContent = `Trigger event for -`;

        const guild = this.guilds.get(guildId);
        this.writeToConsole(`Loaded guild ${guild.name} with ${guild.fakeUsers.length} fake player${guild.fakeUsers.length > 1 ? 's' : ''}`);
    }

    private renderFakePlayers(guildId: string) {
        const fakePlayers = this.guilds.get(guildId).fakeUsers;
        this.fakePlayersListEl.innerHTML = '';

        fakePlayers.forEach(player => {
            const containerEl = document.createElement('div');
            containerEl.className = 'fake-player';
            containerEl.innerHTML = `
            <div>${player.name}</div>
            <div>${player.id}</div>
            `;

            containerEl.addEventListener('click', () => {
                if (this.activeFakeUserRef === containerEl) {
                    return;
                }

                if (!this.activeFakeUserRef) {
                    this.activeFakeUserRef = containerEl;
                    this.activeFakeUserRef.classList.toggle('active');
                } else {
                    this.activeFakeUserRef.classList.toggle('active');
                    this.activeFakeUserRef = containerEl;
                    this.activeFakeUserRef.classList.toggle('active');
                }

                this.currentFakePlayer = player;
                document.getElementById('event-player').textContent = `Trigger event for ${player.name}`;
            });

            const headingEl = document.createElement('div');
            headingEl.className = 'fake-player'

            this.fakePlayersListEl.appendChild(containerEl);
            this.fakePlayersListEl.scrollTop = this.fakePlayersListEl.scrollHeight;
        });
    }

    private renderPickups(guildId: string) {
        const pickups = this.guilds.get(guildId).activePickups;
        this.pickupListEl.innerHTML = '';

        pickups.forEach(pickup => {
            const playerStr = pickup.players.map(player => player.nick).join(', ');
            const containerEl = document.createElement('div');
            containerEl.className = 'pickup-item';
            containerEl.innerHTML = `
            <div>${pickup.name} - ${pickup.players.length} / ${pickup.maxPlayers}</div>
            <div>${playerStr}</div>
            `;

            this.pickupListEl.appendChild(containerEl);
        });
    }

    private renderPickupBox(guildId: string) {
        const allPickups = this.guilds.get(guildId).allPickups;
        this.pickupBoxEl.innerHTML = '';

        allPickups.forEach(pickup => {
            const pickupContainerEl = document.createElement('div');
            pickupContainerEl.className = 'pickup';

            const pickupNameEl = document.createElement('span');
            pickupNameEl.className = 'pickup__name';
            pickupNameEl.textContent = `${pickup.name}`;

            const addPlayerBtnEl = document.createElement('div');
            addPlayerBtnEl.className = 'pickup__btn';
            addPlayerBtnEl.textContent = 'Add'

            addPlayerBtnEl.addEventListener('click', () => {
                this.addToPickup(guildId, pickup.id);
            });

            const removePlayerBtnEl = document.createElement('div');
            removePlayerBtnEl.className = 'pickup__btn';
            removePlayerBtnEl.textContent = 'Remove';

            removePlayerBtnEl.addEventListener('click', () => {
                this.removeFromPickup(guildId, pickup.id);
            })

            const clearPickupBtnEl = document.createElement('div');
            clearPickupBtnEl.className = 'pickup__btn';
            clearPickupBtnEl.textContent = 'Clear';

            clearPickupBtnEl.addEventListener('click', () => {
                this.clearPickup(guildId, pickup.id);
            });

            pickupContainerEl.append(pickupNameEl, addPlayerBtnEl, removePlayerBtnEl, clearPickupBtnEl);
            this.pickupBoxEl.appendChild(pickupContainerEl);
        });
    }

    private addToPickup(guildId: string, configId: number) {
        const guild = this.guilds.get(guildId);

        if (!guild.fakeUsers.length) {
            return this.writeToConsole('No fake players available');
        }

        let availablePlayer;
        const foundPickup = guild.activePickups.find(pu => pu.configId === configId);

        if (foundPickup) {
            // Check if any fake player is available
            availablePlayer = guild.fakeUsers.find(user => !foundPickup.players.map(player => player.id).includes(user.id));

            if (!availablePlayer) {
                return this.writeToConsole('No fake player available for this pickup');
            }
        } else {
            availablePlayer = guild.fakeUsers[0];
        }

        const data = {
            guild: guildId,
            userId: availablePlayer.id,
            configId
        };

        this.writeToConsole(`Added player ${availablePlayer.name}`);
        this.client.emit('add', JSON.stringify(data));
    }

    private removeFromPickup(guildId: string, configId: number) {
        const guild = this.guilds.get(guildId);

        const foundPickup = guild.activePickups.find(pu => pu.configId === configId);

        if (!foundPickup) {
            return this.writeToConsole('The given pickup is not active');
        }

        const gotFakePlayer = guild.fakeUsers.find(user => foundPickup.players.map(player => player.id).includes(user.id));

        if (!gotFakePlayer) {
            return this.writeToConsole('No fake player added to this pickup');
        }

        const data = {
            guildId: guildId,
            userId: gotFakePlayer.id,
            configId
        };

        this.writeToConsole(`Removed player ${gotFakePlayer.name}`);
        this.client.emit('remove', JSON.stringify(data));
    }

    private clearPickup(guildId: string, configId: number) {
        const data = {
            guild: guildId,
            configId
        };

        this.client.emit('clear', JSON.stringify(data));
    }

    private updateGuild(data: string) {
        const convertedData = JSON.parse(data) as GuildData;
        this.guilds.set(convertedData.id, convertedData);
        this.renderPickups(convertedData.id);
        this.renderFakePlayers(convertedData.id);
    }

    private writeToConsole(text: string) {
        const time = new Date().toLocaleTimeString();

        const lineContainerEl = document.createElement('div');
        lineContainerEl.className = 'console__line';
        lineContainerEl.innerHTML = `
        <div>${text}</div>
        <div>${time}</div>
        `;

        this.consoleContentEl.appendChild(lineContainerEl);
        this.consoleContentEl.scrollTop = this.consoleContentEl.scrollHeight;
    }
}

interface GuildData {
    id: string,
    name: string,
    fakeUsers: { id: string; name: string }[];
    activePickups: { name: string, players: { id: string | null, nick: string | null }[]; maxPlayers: number; configId: number }[];
    allPickups: { id: number, name: string, added: number, max: number }[];
}

new DevApp();