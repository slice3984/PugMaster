import OverviewPage from './statsPages/overviewPage';
import PickupsPage from './statsPages/pickupsPage';

export default class StatsPage {
    private currentPage: HTMLDivElement;
    private alreadyLoaded: Map<string, boolean> = new Map();
    private navPointRefs: Map<string, HTMLDivElement> = new Map();
    private currentNavPointRef: HTMLDivElement;


    constructor(startPage: string) {
        this.init();

        // Attempt to use the passed argument, if it fails, fallback to overview
        const page = startPage ? startPage.toLowerCase() : null;

        if (this.navPointRefs.has(page)) {
            this.switchPage(page)
        } else {
            this.switchPage('overview');
        }
    }

    private init() {
        document.getElementById('stats-page-nav').querySelectorAll('div').forEach((node, index) => {
            const id = node.id;
            this.navPointRefs.set(id, node);
            this.alreadyLoaded.set(id, false);

            node.addEventListener('click', () => {
                if (!index) {
                    document.location.href = './stats';
                    return;
                }

                this.switchPage(id);
            });
        });
    }

    private switchPage(newPageId: string) {
        const navRef = this.navPointRefs.get(newPageId);

        if (navRef === this.currentNavPointRef) {
            return;
        }

        if (this.currentNavPointRef) {
            this.currentNavPointRef.classList.remove('active-stats');
        }

        this.currentNavPointRef = navRef;
        this.currentNavPointRef.classList.add('active-stats');

        const alreadyLoaded = this.alreadyLoaded.get(newPageId);

        if (!alreadyLoaded) {
            this.loadContent(newPageId);
        }

        if (this.currentPage) {
            this.currentPage.classList.toggle('hidden');
        }

        this.currentPage = document.getElementById(`${newPageId}-content`) as HTMLDivElement;
        this.currentPage.classList.toggle('hidden');

        // Modify url
        const urlParams = new URL(document.location.href).searchParams;
        urlParams.set('page', newPageId);
        window.history.pushState('', '', `stats?${urlParams.toString()}`);
    }

    private loadContent(pageId: string) {
        switch (pageId) {
            case 'overview':
                new OverviewPage(new URL(document.location.href).searchParams.get('server'));
                break;
            case 'pickups':
                new PickupsPage(new URL(document.location.href).searchParams.get('server'));
                break;
            case 'players':

                break;
        }

        this.alreadyLoaded.set(pageId, true);
    }
}