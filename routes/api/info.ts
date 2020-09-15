import express from 'express';
import infoController from '../../controllers/info';

const router = express.Router();

router.post('/info', (req: express.Request, res: express.Response) => {
    infoController(req, res);
});

export default router;