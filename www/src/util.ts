export default class Util {
    private constructor() { }

    static formatTime = ms => {
        const stringParts = [];
        let seconds = (ms / 1000) | 0;
        ms -= seconds * 1000;
        let minutes = (seconds / 60) | 0;
        seconds -= minutes * 60;
        let hours = (minutes / 60) | 0;
        minutes -= hours * 60;
        let days = (hours / 24) | 0;
        hours -= days * 24;
        let weeks = (days / 7) | 0;
        days -= weeks * 7;
        const shorten = Math.sign(minutes) + Math.sign(hours) + Math.sign(days) + Math.sign(weeks) + Math.sign(seconds) > 2;
        if (shorten) {
            if (weeks > 0) {
                stringParts.push(`${weeks}w`);
            }
            if (days > 0) {
                stringParts.push(`${days}d`);
            }
            if (hours > 0) {
                stringParts.push(`${hours}h`);
            }
            if (minutes > 0) {
                stringParts.push(`${minutes}m`);
            }
        } else {
            if (weeks > 0) {
                stringParts.push(`${weeks} week${weeks > 1 ? 's' : ''}`);
            }
            if (days > 0) {
                stringParts.push(`${days} day${days > 1 ? 's' : ''}`);
            }
            if (hours > 0) {
                stringParts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
            }
            if (minutes > 0) {
                stringParts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
            }
            if (seconds > 0 && stringParts.length < 2) {
                stringParts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);
            }
        }
        return stringParts.join(shorten ? ' ' : ' and ');
    }
}