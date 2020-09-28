import { postApi } from '../util';

enum SortBy { DATE = 'date', GAMETYPE = 'gt', COUNT = 'count' };

export default class PickupsPage {
    private guildId: string;
    private pickupCount: number;
    private currentPage;
    private currentExtendedContent: HTMLDivElement;
    private currentExtendedShare: HTMLDivElement;

    // Used to set a fixed width for both
    private maxLengthName: number;
    private maxLengthPlayers: number;

    // DOM refs
    private contentContainerEl = document.getElementById('pickups-content') as HTMLDivElement;
    private pickupListEl = document.getElementById('pickup-list') as HTMLDivElement;
    private navPagesEl = document.getElementById('pages');
    private previousBtnEl = document.getElementById('previous') as HTMLDivElement;
    private nextBtnEl = document.getElementById('next');

    // Sorting
    private sortDateBtnEl = document.getElementById('sort-date');
    private sortGametypeBtnEl = document.getElementById('sort-gametype');
    private sortCountBtnEl = document.getElementById('sort-count');

    private sortOrderDateEl = document.getElementById('sort-date-order') as HTMLDivElement;
    private sortOrderGametypeEl = document.getElementById('sort-gametype-order') as HTMLDivElement;
    private sortOrderCountEl = document.getElementById('sort-count-order') as HTMLDivElement;

    private currentSortBtnRef = this.sortDateBtnEl;
    private currentSort: SortBy = SortBy.DATE;
    private sortOrders = new Map([[SortBy.DATE, true], [SortBy.GAMETYPE, true], [SortBy.COUNT, true]]);

    private displayPickup;

    constructor(guildId: string) {
        this.guildId = guildId;

        const urlObj = new URL(window.location.href);
        const pageNumParam = urlObj.searchParams.get('pageNum');
        const orderByParam = urlObj.searchParams.get('by')
        const descParam = urlObj.searchParams.get('desc');
        const pickupParam = urlObj.searchParams.get('pickup');

        (async () => {
            const count = await postApi('/pickup-count', { id: guildId });
            this.pickupCount = count.amount;

            if (!this.pickupCount) {
                return this.renderNoHistory();
            }

            // Ignore page & sorting params when some pickup id is given
            if (pickupParam && Number.isInteger(+pickupParam)) {
                const rowNum = await postApi('/pickup-row-num', { id: this.guildId, pickup: pickupParam });

                if (rowNum.row) {
                    this.displayPickup = +pickupParam;
                    return await this.renderPage((Math.ceil(rowNum.row / 10)));
                }
            } else {
                if (orderByParam && ['date', 'gt', 'count'].includes(orderByParam.toLowerCase())) {
                    const sort = orderByParam.toLowerCase() as SortBy;

                    this.currentSortBtnRef.classList.remove('active-sort');

                    switch (sort) {
                        case SortBy.DATE:
                            this.currentSortBtnRef = this.sortDateBtnEl;
                            break;
                        case SortBy.GAMETYPE:
                            this.currentSortBtnRef = this.sortGametypeBtnEl;
                            break;
                        case SortBy.COUNT:
                            this.currentSortBtnRef = this.sortCountBtnEl;
                    }

                    this.currentSortBtnRef.classList.add('active-sort');
                    this.currentSort = sort;
                }

                if (descParam && ['0', '1'].includes(descParam)) {
                    this.sortOrders.set(this.currentSort, descParam === '1' ? true : false);
                    this.updateOrderSvg(this.currentSort);
                }
            }

            if (pageNumParam && Number.isInteger(+pageNumParam)) {
                // Check if the page num is valid
                if (Math.ceil(this.pickupCount / 10) >= +pageNumParam) {
                    return await this.renderPage(+pageNumParam);
                }
            }

            await this.renderPage(1);
        })();

        this.initEventListeners();
    }

    private initEventListeners() {
        this.nextBtnEl.addEventListener('click', () => {
            this.renderPage(this.currentPage + 1);
        });

        this.previousBtnEl.addEventListener('click', () => {
            this.renderPage(this.currentPage - 1);
        });

        const handleSortBtn = (by: SortBy) => {
            if (by === this.currentSort) {
                return;
            }

            this.currentSort = by;
            this.currentSortBtnRef.classList.remove('active-sort');

            switch (by) {
                case SortBy.DATE:
                    this.currentSortBtnRef = this.sortDateBtnEl;
                    break;
                case SortBy.GAMETYPE:
                    this.currentSortBtnRef = this.sortGametypeBtnEl;
                    break;
                case SortBy.COUNT:
                    this.currentSortBtnRef = this.sortCountBtnEl;
            }

            this.currentSortBtnRef.classList.add('active-sort');
            this.renderPage(this.currentPage, true);
        };

        this.sortDateBtnEl.addEventListener('click', handleSortBtn.bind(null, SortBy.DATE));
        this.sortGametypeBtnEl.addEventListener('click', handleSortBtn.bind(null, SortBy.GAMETYPE));
        this.sortCountBtnEl.addEventListener('click', handleSortBtn.bind(null, SortBy.COUNT));

        const handleSortOrderBtn = (by: SortBy) => {
            this.sortOrders.set(by, !this.sortOrders.get(by));
            this.updateOrderSvg(by);

            if (by !== this.currentSort) {
                handleSortBtn(by);
            } else {
                this.currentSort = by;
                this.renderPage(this.currentPage, true);
            }
        }

        this.sortOrderDateEl.addEventListener('click', handleSortOrderBtn.bind(null, SortBy.DATE));
        this.sortOrderGametypeEl.addEventListener('click', handleSortOrderBtn.bind(null, SortBy.GAMETYPE));
        this.sortOrderCountEl.addEventListener('click', handleSortOrderBtn.bind(null, SortBy.COUNT));
    }

    private updateOrderSvg(by: SortBy) {
        let sortElRef: HTMLDivElement;

        switch (by) {
            case SortBy.DATE:
                sortElRef = this.sortOrderDateEl;
                break;
            case SortBy.GAMETYPE:
                sortElRef = this.sortOrderGametypeEl;
                break;
            case SortBy.COUNT:
                sortElRef = this.sortOrderCountEl;
        }

        const svgEl = sortElRef.firstElementChild;
        svgEl.innerHTML = `<use xlink:href="./www/homepage/img/sprite.svg#icon-sort-${this.sortOrders.get(by) ? 'asc' : 'desc'}"></use>`;
    }

    private renderNoHistory() {
        this.contentContainerEl.innerHTML = `<div class="no-history">No pickup history for this server</h1>`;
    }

    private async renderPage(page: number, force = false) {
        if (!force && this.currentPage && this.currentPage === page) {
            return;
        }

        this.currentPage = page;

        let pageData: PickupInfo[] = await postApi('/pickups', {
            id: this.guildId,
            page,
            by: this.currentSort,
            desc: this.sortOrders.get(this.currentSort) ? '1' : '0'
        });

        this.pickupListEl.innerHTML = ``;

        this.maxLengthName = Math.max(...pageData.map(pickup => pickup.name.length));
        this.maxLengthPlayers = Math.max(...pageData.map(pickup => `${pickup.players} Players`.length));

        let toExtend: HTMLDivElement = null;

        for (const result of pageData) {
            const el = await this.generatePickupEl(result);
            if (result.id == this.displayPickup) {
                toExtend = el;
            }
            this.pickupListEl.appendChild(el);
        }

        if (toExtend) {
            await this.loadPickupInfo(this.displayPickup, toExtend);
            this.displayPickup = null;
        }

        this.modifyUrl('pageNum', page.toString(), `Pickup history - Page ${page}`);
        this.modifyUrl('by', this.currentSort);
        this.modifyUrl('desc', this.sortOrders.get(this.currentSort) ? '1' : '0');

        this.renderNav();
    }

    private async generatePickupEl(pickup: PickupInfo): Promise<HTMLDivElement> {
        const itemContainerEl = document.createElement('div');
        itemContainerEl.className = 'pickup-item';
        itemContainerEl.setAttribute('data-id', pickup.id.toString());

        const itemHeaderEl = document.createElement('div');
        itemHeaderEl.className = 'pickup-item__header';

        const itemGroupEl = document.createElement('div');
        itemGroupEl.className = 'pickup-item__group';

        const itemNameEl = document.createElement('div');
        itemNameEl.className = 'pickup-item__name';
        itemNameEl.textContent = pickup.name;
        itemNameEl.style.width = `${this.maxLengthName + 1}rem`;

        const itemPlayersEl = document.createElement('div');
        itemPlayersEl.className = 'pickup-item__players';
        itemPlayersEl.textContent = `${pickup.players} Players`;
        itemPlayersEl.style.width = `${this.maxLengthPlayers}rem`;

        const itemDateEl = document.createElement('div');
        itemDateEl.className = 'pickup-item__date';
        itemDateEl.textContent = new Date(pickup.date).toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "2-digit",
            day: "numeric",
            hour: '2-digit',
            minute: '2-digit'
        });

        const itemControlsEl = document.createElement('div');
        itemControlsEl.className = 'pickup-item__controls';

        const itemShareEl = document.createElement('div');

        const svgShareEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgShareEl.setAttribute('class', 'pickups__icon');
        svgShareEl.innerHTML = '<use xlink:href="./www/homepage/img/sprite.svg#icon-share"></use>';

        const itemMoreInfoEl = document.createElement('div');

        const svgMoreInfoEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgMoreInfoEl.setAttribute('class', 'pickups__icon');
        svgMoreInfoEl.innerHTML = '<use xlink:href="./www/homepage/img/sprite.svg#icon-extend"></use>';

        const itemContentEl = document.createElement('div');
        itemContentEl.className = 'pickup-item__content hidden';

        itemMoreInfoEl.addEventListener('click', async () => {
            await this.loadPickupInfo(pickup.id, itemContainerEl);
        });

        const shareEl = document.createElement('div');
        shareEl.className = 'pickup-item__share hidden';

        const shareLink = document.createElement('div');
        shareLink.className = 'pickup-item__share-link';

        const urlParams = new URL(document.location.href).searchParams;
        urlParams.delete('pageNum');
        urlParams.set('pickup', pickup.id.toString());

        const url = `${window.location.href.split('?')[0]}?server=${this.guildId}&page=pickups&pickup=${pickup.id}`;
        shareLink.textContent = url;

        const shareCopyBtn = document.createElement('div');
        shareCopyBtn.className = 'pickup-item__share-btn';
        shareCopyBtn.textContent = 'Copy';

        shareCopyBtn.addEventListener('click', async () => {
            await navigator.clipboard.writeText(url);
            shareCopyBtn.textContent = 'Copied';

            setTimeout(() => {
                shareCopyBtn.textContent = 'Copy';
            }, 1000);
        });

        itemShareEl.addEventListener('click', () => {
            if (this.currentExtendedShare === shareEl) {
                this.currentExtendedShare.classList.add('hidden');
                this.currentExtendedShare = null;
                return;
            }

            if (this.currentExtendedShare) {
                this.currentExtendedShare.classList.add('hidden');
            }

            this.currentExtendedShare = shareEl;
            this.currentExtendedShare.classList.toggle('hidden');
        });

        // Link together
        itemGroupEl.append(itemNameEl, itemPlayersEl);
        itemHeaderEl.append(itemGroupEl, itemDateEl);
        itemContainerEl.appendChild(itemHeaderEl);
        itemShareEl.appendChild(svgShareEl);
        itemMoreInfoEl.appendChild(svgMoreInfoEl);
        itemControlsEl.append(itemShareEl, itemMoreInfoEl);
        itemHeaderEl.append(itemControlsEl);
        shareEl.append(shareLink, shareCopyBtn);
        itemContainerEl.append(shareEl, itemContentEl);

        return itemContainerEl;
    }

    private generatePageNumEl(pageNum: number): HTMLDivElement {
        const pageNumEl = document.createElement('div');
        pageNumEl.className = 'pickups__nav-page';
        pageNumEl.textContent = pageNum.toString();

        if (this.currentPage === pageNum) {
            pageNumEl.classList.add('active-page');
        }

        pageNumEl.addEventListener('click', () => {
            this.renderPage(pageNum);
        });

        return pageNumEl;
    }

    private async renderNav() {
        this.navPagesEl.innerHTML = '';

        let previousPages = this.currentPage - 1;
        let leftPages = Math.ceil((this.pickupCount - this.currentPage * 10) / 10);

        if (!previousPages) {
            this.previousBtnEl.classList.add('hidden');
        } else {
            this.previousBtnEl.classList.remove('hidden');
        }

        if (!leftPages) {
            this.nextBtnEl.classList.add('hidden');
        } else {
            this.nextBtnEl.classList.remove('hidden');
        }

        if (previousPages) {
            this.navPagesEl.appendChild(this.generatePageNumEl(1));

            for (let i = this.currentPage - 3; i < this.currentPage; i++) {
                if (i < 2) {
                    continue;
                }
                this.navPagesEl.appendChild(this.generatePageNumEl((i)));
            }
        }

        this.navPagesEl.appendChild(this.generatePageNumEl(this.currentPage));

        if (leftPages) {
            for (let i = this.currentPage; i < (this.currentPage + leftPages); i++) {
                if (i > (this.currentPage + leftPages) || (i - this.currentPage == 4)) {
                    return;
                }

                this.navPagesEl.appendChild(this.generatePageNumEl(i + 1));
            }
        }
    }

    private async loadPickupInfo(pickupId: number, domRef: HTMLDivElement) {
        // Check if the content is already loaded
        const contentEl = domRef.lastElementChild as HTMLDivElement;

        if (this.currentExtendedContent === contentEl) {
            this.currentExtendedContent.classList.add('hidden');
            this.currentExtendedContent = null;
            return;
        }

        // No content, request pickup info from the API and render it
        if (!contentEl.innerHTML.length) {
            const generatePlayerEl = (name: string, elo: number | null) => {
                const playerContainerEl = document.createElement('a');
                playerContainerEl.className = 'pickup-item__player';

                playerContainerEl.href = '#';

                const nameEl = document.createElement('div');
                nameEl.className = 'pickup-item__player-name';
                nameEl.textContent = name;

                const eloEl = document.createElement('div');
                eloEl.className = 'pickup-item__player-elo';
                eloEl.innerHTML = `<div>${elo ? `Elo: ${elo}` : 'Elo: -'}</div>`;

                playerContainerEl.append(nameEl, eloEl);

                return playerContainerEl;
            }

            const pickupInfo: PickupInfoAPI = await postApi('/pickup-info', { pickup: pickupId, id: this.guildId });

            pickupInfo.teams.forEach(team => {
                let teamName = pickupInfo.teams.length === 1 ? 'Players' : `Team ${team.name}`;

                const headingTeam = document.createElement('div');
                headingTeam.className = 'pickup-item__heading';
                headingTeam.textContent = teamName;

                const playerListEl = document.createElement('div');
                playerListEl.className = 'pickup-item__player-list';

                contentEl.append(headingTeam);

                team.players.forEach(player => playerListEl.append(generatePlayerEl(player.nick, player.elo)));

                contentEl.append(playerListEl);
            });

            const aboutEl = document.createElement('div');
            aboutEl.className = 'pickup-item__about';

            aboutEl.innerHTML = `
            <p>Rated: ${pickupInfo.isRated ? '<span class="green">Yes</span>' : '<span class="red">No</span>'}</p>
            <p>Winner: ${pickupInfo.winnerTeam ? `<span class="green">Team ${pickupInfo.winnerTeam}</span>` : '<span class="red">Unknown</span>'}</p> 
            `;

            contentEl.append(aboutEl);
        }

        if (this.currentExtendedContent) {
            this.currentExtendedContent.classList.add('hidden');
        }

        this.currentExtendedContent = contentEl;
        this.currentExtendedContent.classList.toggle('hidden');
    }

    private modifyUrl(param: string, value: string, title: string = '') {
        const urlParams = new URL(document.location.href).searchParams;
        urlParams.set(param, value);
        window.history.pushState('', title, `stats?${urlParams.toString()}`);
    }
}

interface PickupInfo {
    id: number;
    name: string;
    players: number;
    date: Date;
}

interface PickupInfoAPI {
    foundPickup: boolean;
    id: number;
    isRated: boolean;
    winnerTeam: string | null;
    teams: {
        name: string;
        players: {
            elo: number;
            nick: string;
        }[]
    }[];
}