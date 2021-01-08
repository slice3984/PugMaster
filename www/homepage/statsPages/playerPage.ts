import { Chart } from 'chart.js';
import { debounce, postApi } from '../util';

interface SearchResult {
    id: string;
    currentNick: string;
    knownAs: string;
    rating: number
}

interface PlayerInfo {
    id: string;
    name: string;
    previousNames: string[];
    rating: { rating: number; variance: number };
    pickupAmount: number;
    playedPickups: { name: string; amount: number }[];
    lastPickupTimes: { name: string; date: Date }[];
    lastPickups: { id: number; name: string; start: Date; isRated: boolean; players: number }[]
}

export default class PlayerPage {
    private guildId: string;
    private userId: string;
    private playerInfo: PlayerInfo;
    private playedPickups: { name: string; amount: number }[];

    // Search
    private currentSearchResults: SearchResult[];
    private currentSearchResultsDomRefs: HTMLDivElement[] = [];
    private resultsLeft: boolean;
    private currentSelected: number;
    private previousSelected: number;

    // Dom refs
    private darkBgEl = document.getElementById('search-bg') as HTMLDivElement;
    private contentEl = document.getElementById('player') as HTMLDivElement;
    private searchContentEl = document.getElementById('search-content') as HTMLDivElement;
    private searchBoxEl = document.getElementById('search') as HTMLDivElement;
    private searchIconEl = document.getElementById('search-icon');
    private playerSearchInputEl = document.getElementById('player-search') as HTMLInputElement;
    private playerSearchResultsEl = document.getElementById('player-search-results') as HTMLDivElement;
    private resultsLeftEl = document.getElementById('results-left') as HTMLDivElement;
    private noResultsEl = document.getElementById('no-results') as HTMLDivElement;

    // Dom refs player stats
    private playerNameEl = document.getElementById('player-name') as HTMLSpanElement;
    private playerEloEl = document.getElementById('player-elo') as HTMLSpanElement;
    private playerPickupAmountEl = document.getElementById('player-pickup-amount') as HTMLSpanElement;
    private playerNamesEl = document.getElementById('player-names') as HTMLUListElement;
    private playerLastGameTimesEl = document.getElementById('last-game-times') as HTMLTableElement;
    private playerLastPickupsEl = document.getElementById('last-pickups') as HTMLDivElement;

    // Canvas
    private chartFontColor = document.body.classList.contains('light-theme') ? '#393b44' : '#d6e0f0';
    private pickupsCanvasEl = document.getElementById('chart-player-pickups') as HTMLCanvasElement;
    private pickupsChart: Chart;

    constructor(guildId: string) {
        this.guildId = guildId;

        const urlObj = new URL(window.location.href);
        const playerId = urlObj.searchParams.get('player');

        this.contentEl.classList.add('hidden');
        this.initSearch();

        if (playerId) {
            this.renderUser(playerId);
        } else {
            this.darkBgEl.classList.remove('hidden');
        }

        // update the charts title font color on theme switch
        document.getElementById('theme-switch').addEventListener('click', () => {
            this.chartFontColor = document.body.classList.contains('light-theme') ? '#393b44' : '#d6e0f0';

            // Update title font color
            this.pickupsChart.options.title.fontColor = this.chartFontColor;
            this.pickupsChart.render();
        });

        this.darkBgEl.addEventListener('click', () => {
            // Only hide the search when content is already loaded
            if (this.userId) {
                this.hideSearch();
            }
        });
    }

    triggerUrlUpdate() {
        window.history.pushState('', '', `stats?page=players&server=${this.guildId}${this.userId ? `&player=${this.userId}` : ''}`);
    }

    private initSearch() {
        this.playerSearchInputEl.addEventListener('input', debounce(async () => {
            if (!this.playerSearchInputEl.value.length) {
                this.clearSearch();
                return;
            }

            const results = await postApi('/player-search', { id: this.guildId, search: this.playerSearchInputEl.value });

            if (results.matches.length) {
                this.currentSearchResults = results.matches;
                this.currentSelected = null;
                this.previousSelected = null;
                this.resultsLeft = results.matchesLeft;
                this.rerenderSearch();
            } else {
                this.clearSearch();
                this.noResultsEl.classList.remove('hidden');
            }
        }, 250));

        this.playerSearchInputEl.addEventListener('keydown', e => {


            if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
                e.preventDefault();
            }

            switch (e.key) {
                case 'ArrowDown':
                    if (!this.currentSearchResults || this.currentSearchResults.length < this.currentSelected + 1) {
                        return;
                    }

                    this.selectResult(this.currentSelected ? ++this.currentSelected : 1);
                    break;
                case 'ArrowUp':
                    if (!this.currentSearchResults || !this.currentSearchResults.length || this.currentSelected === 1) {
                        return;
                    }

                    this.selectResult(this.currentSelected ? --this.currentSelected : 1);
                    break;
                case 'Enter':
                    if (this.currentSelected) {
                        this.renderUser(this.currentSearchResults[this.currentSelected - 1].id);
                    }
            }
        });

        this.searchIconEl.addEventListener('click', this.showSearch.bind(this));
    }

    private showSearch() {
        this.searchIconEl.classList.add('hidden');
        this.searchBoxEl.classList.remove('hidden');
        this.searchContentEl.classList.remove('shrink-animation');
        this.darkBgEl.classList.remove('hidden');
    }

    private selectResult(position: number) {
        if (this.previousSelected) {
            this.currentSearchResultsDomRefs[this.previousSelected - 1].classList.remove('player-selected');
        }

        const ref = this.currentSearchResultsDomRefs[position - 1];
        ref.classList.add('player-selected');
        this.currentSelected = position;
        this.previousSelected = position;
    }

    private async renderUser(userId: string) {
        this.hideSearch();

        if (this.userId === userId) {
            return;
        }

        const firstRender = this.userId ? false : true;

        this.userId = userId;

        this.playerInfo = await postApi('/player', { id: this.guildId, player: this.userId });

        // Display the search if a wrong user id is provided
        if (!this.playerInfo.id) {
            this.userId = null;
            this.contentEl.classList.add('hidden');
            return this.showSearch();
        }

        this.playedPickups = await postApi('/played-pickups', { id: this.guildId });

        this.renderPlayerInfo();
        this.renderLastGametimes();
        this.renderLastPickups();

        if (firstRender) {
            this.initChart();
        } else {
            this.pickupsChart.data = this.generateChartData();
            this.pickupsChart.update();
        }

        this.triggerUrlUpdate();
    }

    private renderPlayerInfo() {
        this.playerNameEl.textContent = this.playerInfo.name;
        this.playerEloEl.textContent = this.playerInfo.rating ? `${this.playerInfo.rating.rating} ± ${this.playerInfo.rating.variance}` : 'None';
        this.playerPickupAmountEl.textContent = this.playerInfo.pickupAmount.toString();

        if (this.playerInfo.previousNames.length) {
            this.playerNamesEl.innerHTML = this.playerInfo.previousNames.map(name => `<li>${name}</li>`).join('');
        } else {
            this.playerNamesEl.innerHTML = '<li>None</li>'
        }
    }

    private initChart() {
        this.pickupsChart = new Chart(this.pickupsCanvasEl.getContext('2d'), {
            type: 'bar',
            data: this.generateChartData(),
            options: {
                title: { display: true, text: 'Played pickups', fontColor: this.chartFontColor, fontFamily: 'Verdana, Geneva, Tahoma, sans-serif', fontSize: 16 },
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true
                        }
                    }]
                }
            }
        });
    }

    private generateChartData() {
        // Order according to the player pickup data
        const orderedServerData = [];

        this.playerInfo.playedPickups.forEach(pickup => {
            const guildPickup = this.playedPickups.find(guildPickup => guildPickup.name === pickup.name);
            orderedServerData.push(guildPickup);
        });

        const playerPickups = {
            label: 'Player',
            backgroundColor: 'rgba(51, 124, 160, 0.4)',
            borderColor: 'rgba(51, 124, 160, 1)',
            data: this.playerInfo.playedPickups.map(pickup => pickup.amount)
        }

        const guildPickups = {
            label: 'Server',
            backgroundColor: 'rgba(125, 29, 63, 0.4)',
            borderColor: 'rgba(125, 29, 63, 1)',
            data: orderedServerData.map(pickup => pickup.amount)
        }

        return {
            labels: this.playerInfo.playedPickups.map(pickup => pickup.name),
            datasets: [playerPickups, guildPickups]
        }
    }

    private renderLastGametimes() {
        this.playerLastGameTimesEl.innerHTML = this.playerInfo.lastPickupTimes.sort((a, b) => a.name.localeCompare(b.name))
            .map(pickup => {
                const formattedDate = new Date(pickup.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "2-digit",
                    day: "numeric",
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return `<tr><td>${pickup.name}</td><td>${formattedDate}</td></tr>`;
            }).join('');
    }

    private renderLastPickups() {
        this.playerLastPickupsEl.innerHTML = '';

        this.playerInfo.lastPickups.forEach(pickup => {
            // Correct width values
            const widthName = Math.max(...this.playerInfo.lastPickups.map(pickup => pickup.name.length));
            const widthPlayers = Math.max(...this.playerInfo.lastPickups.map(pickup => `${pickup.players} Players`.length));

            const pickupEl = document.createElement('a');
            pickupEl.target = '_blank';
            pickupEl.className = 'player-pickup-item';
            pickupEl.href = `./stats?server=${this.guildId}&page=pickups&pickup=${pickup.id}`;

            const formattedDate = new Date(pickup.start).toLocaleDateString(undefined, {
                weekday: "short",
                year: "numeric",
                month: "2-digit",
                day: "numeric",
                hour: '2-digit',
                minute: '2-digit'
            });

            pickupEl.innerHTML = `
            <div class="player-pickup-item__info">
                <div class="player-pickup-item__box" style="width: ${widthName + 1}rem">${pickup.name}</div>
                <div class="player-pickup-item__box" style="width: ${widthPlayers}rem">${pickup.players} Players</div>
            </div>
            <div class="player-pickup-item__date">${formattedDate}</div>
            <svg xmlns:xlink="http://www.w3.org/1999/xlink" class="player-pickup-item__icon">
                <use xlink:href="./www/homepage/img/sprite.svg#icon-link"></use>
            </svg>
            `;

            this.playerLastPickupsEl.appendChild(pickupEl);
        });
    }

    private hideSearch() {
        this.searchBoxEl.classList.add('hidden');
        this.searchIconEl.classList.remove('hidden');
        this.searchContentEl.classList.add('shrink-animation');
        this.contentEl.classList.remove('hidden');
        this.darkBgEl.classList.add('hidden');
    }

    private rerenderSearch() {
        this.playerSearchResultsEl.innerHTML = '';
        this.noResultsEl.classList.add('hidden');
        this.currentSearchResultsDomRefs = [];

        this.currentSearchResults.forEach((result, index) => {
            const resultEl = this.generateSearchResult(result, index + 1);
            this.currentSearchResultsDomRefs.push(resultEl);
            this.playerSearchResultsEl.appendChild(resultEl);
        });

        if (this.resultsLeft) {
            this.resultsLeftEl.classList.remove('hidden');
        } else {
            this.resultsLeftEl.classList.add('hidden');
        }
    }

    private clearSearch() {
        this.playerSearchResultsEl.innerHTML = '';
        this.resultsLeftEl.classList.add('hidden');
        this.noResultsEl.classList.add('hidden');
    }

    private generateSearchResult(data: SearchResult, ownPos: number) {
        const searchResultEl = document.createElement('div');
        searchResultEl.className = 'player-search__item';

        searchResultEl.innerHTML = `
        <div class="player-search__item-left">
            <h2>${data.currentNick}${data.knownAs ? ` (Known as ${data.knownAs})` : ''}</h2>
            <p>${data.id}</p>
        </div>
        <div class="player-search__item-right">
            <div>Elo:</div>
            <div>${data.rating ? data.rating : 'None'}</div>
        </div>
        `;

        searchResultEl.addEventListener('mouseenter', () => {
            this.selectResult(ownPos);
        });

        searchResultEl.addEventListener('click', () => {
            this.renderUser(this.currentSearchResults[this.currentSelected - 1].id);
        })

        return searchResultEl;
    }
}