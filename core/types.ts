export interface Config {
    bot: {
        token: string
    };
    db: {
        server: string;
        user: string;
        password: string;
        db: string;
    }
};