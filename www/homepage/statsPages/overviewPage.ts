import { Chart } from 'chart.js';
import { postApi } from '../util';

interface GuildInfo {
    status: 'success' | 'fail';
    gotData: boolean;
    guildIcon?: string | null;
    guildName?: string;
    guildId?: string;
    memberCount?: number;
    pickupPlayerCount?: number; // Players who are stored and played at least one pickup
    pickupCount?: number;
    lastGame?: { name: string; date: Date };
    pickupsChartData?: {
        name: string;
        amount: number;
    }[];
    topPlayersChartData?: {
        nick: string;
        amount: number;
    }[];
    topPlayersRatingsChartData?: {
        nick: string;
        amount: number;
    }[];
    activityTimesChartData?: Date[];
}

const backgroundColor = [
    'rgba(190, 110, 70, 0.4)',
    'rgba(205, 231, 176, 0.4)',
    'rgba(163, 191, 168, 0.4)',
    'rgba(114, 134, 160, 0.4)',
    'rgba(89, 89, 74, 0.4)',
    'rgba(51, 124, 160, 0.4)',
    'rgba(130, 113, 145, 0.4)',
    'rgba(125, 29, 63, 0.4)',
    'rgba(81, 37, 0, 0.4)',
    'rgba(91, 80, 122, 0.4)'
];

const borderColor = [
    'rgba(190, 110, 70, 1)',
    'rgba(205, 231, 176, 1)',
    'rgba(163, 191, 168, 1)',
    'rgba(114, 134, 160, 1)',
    'rgba(89, 89, 74, 1)',
    'rgba(51, 124, 160, 1)',
    'rgba(130, 113, 145, 1)',
    'rgba(125, 29, 63, 1)',
    'rgba(81, 37, 0, 1)',
    'rgba(91, 80, 122, 1)'
];


export default class OverviewPage {
    private overViewContentEl = document.getElementById('overview-content');
    private guildDataDivEl = document.getElementById('guild-data');

    // Adjust chart title colors based on theme
    private bodyEl = document.body;
    private chartFontColor = this.bodyEl.classList.contains('light-theme') ? '#393b44' : '#d6e0f0';

    // Chart container refs
    private pickupsChartContainerEl = document.getElementById('chart-container-pickups');
    private topChartContainerEl = document.getElementById('chart-container-top');
    private activityChartContainerEl = document.getElementById('chart-container-activity');

    // Canvas refs
    private pickupsCanvasEl = document.getElementById('chart-pickups') as HTMLCanvasElement;
    private topCanvasEl = document.getElementById('chart-top') as HTMLCanvasElement;
    private activityCanvasEl = document.getElementById('chart-activity') as HTMLCanvasElement;

    // Charts
    private pickupChart: Chart;
    private topChart: Chart;
    private activityChart: Chart;

    // API data
    private guildId: string;
    private guildInfo: GuildInfo;
    private gotGuild = false;
    private gotData = false;

    constructor(guildId: string) {
        this.guildId = guildId;

        (async () => {
            await this.getData();

            if (this.gotGuild) {
                this.generateGuildInfo();

                // Render the charts
                if (this.gotData) {
                    this.generatePickupsChart();
                    this.generateTopChart();
                    this.generateActivityChart();

                    // update the charts title font color on theme switch
                    document.getElementById('theme-switch').addEventListener('click', () => {
                        this.chartFontColor = this.bodyEl.classList.contains('light-theme') ? '#393b44' : '#d6e0f0';

                        // Update title font color
                        this.pickupChart.options.title.fontColor = this.chartFontColor;
                        this.topChart.options.title.fontColor = this.chartFontColor;
                        this.activityChart.options.title.fontColor = this.chartFontColor;

                        this.pickupChart.render();
                        this.topChart.render();
                        this.activityChart.render();
                    });

                } else {
                    this.activityChartContainerEl.innerHTML = ``;
                    this.pickupsChartContainerEl.appendChild(this.generateMissingDataEl());
                    this.topChartContainerEl.appendChild(this.generateMissingDataEl());
                    this.activityChartContainerEl.appendChild(this.generateMissingDataEl());
                }
            } else {
                this.showUnknownGuild();
            }
        })();
    }

    triggerUrlUpdate() {
        window.history.pushState('', '', `stats?page=overview&server=${this.guildId}`);
    }

    private async getData() {
        const receivedData: GuildInfo = await postApi('/guildinfo', { id: this.guildId });

        if (receivedData.status === 'success') {
            this.guildInfo = receivedData;

            this.gotGuild = true;

            if (receivedData.gotData) {
                this.gotData = true;
            }
        }
    }

    private generateGuildInfo() {
        const generateSpan = (content: string) => {
            const tag = document.createElement('span');
            tag.className = 'guild-info__value';
            tag.textContent = content;

            return tag;
        };

        document.getElementById('guild-name').textContent = this.guildInfo.guildName;

        const guildIconEl = document.getElementById('guild-image');

        if (this.guildInfo.guildIcon) {
            const imgEl = document.createElement('img');
            imgEl.setAttribute('src', this.guildInfo.guildIcon);
            guildIconEl.appendChild(imgEl);
        } else {
            const placeholderDivEl = document.createElement('div');
            placeholderDivEl.className = 'guild-info__placeholder';
            guildIconEl.appendChild(placeholderDivEl);
        }

        let lastGame = '-';

        if (this.gotData) {
            const dateObj = new Date(this.guildInfo.lastGame.date).toLocaleDateString(undefined, {
                weekday: "short",
                year: "numeric",
                month: "2-digit",
                day: "numeric",
                hour: '2-digit',
                minute: '2-digit'
            });

            lastGame = dateObj;
        }

        const values = [
            generateSpan(this.guildInfo.guildId),
            generateSpan(this.guildInfo.memberCount.toString()),
            generateSpan(this.guildInfo.pickupPlayerCount ? this.guildInfo.pickupPlayerCount.toString() : '-'),
            generateSpan(this.guildInfo.pickupCount ? this.guildInfo.pickupCount.toString() : '-'),
            generateSpan(lastGame)
        ]

        this.guildDataDivEl.querySelectorAll('p').forEach((node, index) => {
            node.insertAdjacentElement('afterend', values[index]);
        })
    }

    private showUnknownGuild() {
        this.overViewContentEl.innerHTML = '';
        const infoEl = document.createElement('h1');
        infoEl.className = 'overview__not-found';
        infoEl.textContent = 'Given server not found.';
        this.overViewContentEl.appendChild(infoEl);
    }

    private generateMissingDataEl() {
        const messageEl = document.createElement('h1');
        messageEl.className = 'overview__not-found';
        messageEl.textContent = 'Not enough data to display the chart';
        return messageEl;
    }

    private generatePickupsChart() {
        this.pickupChart = new Chart(this.pickupsCanvasEl.getContext('2d'), {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: this.guildInfo.pickupsChartData.map(pickup => pickup.amount),
                    backgroundColor,
                    borderColor
                }],
                labels: this.guildInfo.pickupsChartData.map(pickup => pickup.name)
            },
            options: {
                legend: {
                    labels: {

                    }
                },
                title: { display: true, text: 'Played pickups', fontColor: this.chartFontColor, fontFamily: 'Verdana, Geneva, Tahoma, sans-serif', fontSize: 16 },
                responsive: true,
                maintainAspectRatio: false,
            }
        });
    }

    private generateTopChart() {
        // Button refs
        const amountBtnEl = document.getElementById('top-amount');
        const ratingBtnEl = document.getElementById('top-rating');

        const buttonRefs = [
            document.getElementById('top-amount'),
            document.getElementById('top-rating')
        ];

        let activeRef = buttonRefs[0];

        const switchDataset = setName => {
            activeRef.classList.toggle('overview__btn--active');

            let labels;
            let data;
            let titleString = '';

            switch (setName) {
                case 'amount':
                    labels = this.guildInfo.topPlayersChartData.map(obj => obj.nick);
                    data = this.guildInfo.topPlayersChartData.map(player => player.amount);
                    activeRef = amountBtnEl;
                    titleString = 'Amount';
                    break;
                case 'rating':
                    labels = this.guildInfo.topPlayersRatingsChartData.map(obj => obj.nick);
                    data = this.guildInfo.topPlayersRatingsChartData.map(player => player.amount);;
                    activeRef = ratingBtnEl;
                    titleString = 'Rating';
            };

            activeRef.classList.toggle('overview__btn--active');

            this.topChart.data.datasets.pop();

            this.topChart.data.labels = labels;
            this.topChart.data.datasets.push({
                label: `${setName === 'amount' ? 'Pickups played' : 'Rating'}`,
                backgroundColor,
                borderColor,
                borderWidth: 1,
                data
            });

            this.topChart.options.title.text = `Top 10 Players - ${titleString}${setName === 'amount' ? ' (Last 30 days)' : ''}`;
            this.topChart.update();
        };

        this.topChart = new Chart(this.topCanvasEl.getContext('2d'), {
            type: 'bar',
            options: {
                title: { display: true, fontColor: this.chartFontColor, fontFamily: 'Verdana, Geneva, Tahoma, sans-serif', fontSize: 16 },
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

        switchDataset('amount');

        const datasetNames = ['amount', 'rating'];

        // No ratings, no need to display any button
        if (!this.guildInfo.topPlayersRatingsChartData.length) {
            buttonRefs.forEach(btn => btn.style.display = 'none');
            return;
        }

        buttonRefs.forEach((ref, index) => {
            ref.addEventListener('click', () => {
                if (activeRef === ref) {
                    return;
                }

                switchDataset(datasetNames[index]);
            })
        })
    }

    private generateActivityChart() {
        // Button refs
        const monthBtnEl = document.getElementById('activity-month');
        const weekdaysBtnEl = document.getElementById('activity-weekdays');
        const timeBtnEl = document.getElementById('activity-time');

        const buttonRefs = [
            document.getElementById('activity-month'),
            document.getElementById('activity-weekdays'),
            document.getElementById('activity-time')
        ];

        let activeRef = buttonRefs[0];
        let dates = [...this.guildInfo.activityTimesChartData];

        const dateData = []; // By month
        const weekdaysData = [] // By weekdays
        const timesData = [] // By time

        // **** By month ****
        const dateOptions = {
            month: "2-digit",
            day: "numeric"
        };

        dates.map(date => new Date(date).toLocaleDateString(undefined, dateOptions))
            .forEach(date => {
                const dateObj = dateData.find(obj => obj.t === date);

                if (dateObj) {
                    dateObj.y++;
                } else {
                    dateData.push({
                        t: date,
                        y: 1
                    });
                }
            });

        // By weekdays
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        days.forEach(day => weekdaysData.push({ t: day, y: 0 }));
        dates.map(date => new Date(date).getDay()).forEach(day => weekdaysData[day].y++);

        // By time
        const times = ['12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am', '12pm',
            '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm'];

        times.forEach(time => timesData.push({ t: time, y: 0 }));

        const formatedtimes = dates.map(date => new Date(date).getHours().toString())
            .map(hour => {
                if (hour[0] === '0') {
                    if (hour.length > 1 && hour[1] !== '0') {
                        return hour[1];
                    }
                }

                if (hour === '24') {
                    return '0';
                }

                return hour;
            });

        formatedtimes.forEach(time => timesData[time].y++);

        const switchDataset = setName => {
            activeRef.classList.toggle('overview__btn--active');

            let labels;
            let data;
            let titleString = '';

            switch (setName) {
                case 'month':
                    labels = dateData.map(obj => obj.t);
                    data = dateData;
                    activeRef = monthBtnEl;
                    titleString = 'month';
                    break;
                case 'weekdays':
                    labels = days;
                    data = weekdaysData;
                    activeRef = weekdaysBtnEl;
                    titleString = 'weekdays';
                    break;
                case 'times':
                    labels = times;
                    data = timesData;
                    activeRef = timeBtnEl;
                    titleString = 'time';
            };

            activeRef.classList.toggle('overview__btn--active');

            this.activityChart.data.datasets.pop();

            this.activityChart.data.labels = labels;
            this.activityChart.data.datasets.push({
                label: 'Pickups',
                backgroundColor: 'rgba(51, 124, 160, 0.4)',
                borderColor: 'rgba(51, 124, 160, 1)',
                data
            });

            this.activityChart.options.title.text = `Pickup activity - ${titleString} (Last 30 days)`;
            this.activityChart.update();
        };

        this.activityChart = new Chart(this.activityCanvasEl.getContext('2d'), {
            type: 'line',
            options: {
                title: { display: true, fontColor: this.chartFontColor, fontFamily: 'Verdana, Geneva, Tahoma, sans-serif', fontSize: 16 },
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                            // @ts-ignore - Property missing in type defs
                            precision: 0
                        }
                    }]
                }
            }
        });

        // Init with month
        switchDataset('month');

        // Event listeners to switch modes
        const datasetNames = ['month', 'weekdays', 'times'];

        buttonRefs.forEach((ref, index) => {
            ref.addEventListener('click', () => {
                if (activeRef === ref) {
                    return;
                }

                switchDataset(datasetNames[index]);
            });
        });
    }
}