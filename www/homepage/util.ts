export const debounce = (func: Function, delay: number) => {
    let timeout;
    return (...args) => {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

export const postApi = async (route: string, data: Object) => {
    const res = await fetch(`./api/${route}`, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (res.status === 429) {
        // Display the ratelimt info
        const ratelimitBoxEl = document.getElementById('ratelimit-box');

        if (ratelimitBoxEl.classList.contains('hidden')) {
            const timeLeft = parseInt(res.headers.get('RateLimit-Reset'));
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            let timeParts = [];

            if (minutes) {
                timeParts.push(minutes + (minutes > 1 ? ' minutes' : ' minute'));
            }

            if (seconds) {
                timeParts.push(seconds + (seconds > 1 ? ' seconds' : ' second'));
            }

            ratelimitBoxEl.querySelector('h2').textContent = `Please wait ${timeParts.join(' and ')}`;
            ratelimitBoxEl.classList.toggle('hidden');
        }

        return null;
    }

    return res.json();
};