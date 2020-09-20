import express from 'express';
import guildInfoController from '../../controllers/guildInfo';

const router = express.Router();

router.post('/guildinfo', (req: express.Request, res: express.Response) => {
    guildInfoController(req, res);
});

export default router;