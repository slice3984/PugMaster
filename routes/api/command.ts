import express from 'express';
import commandListController from '../../controllers/commands';

const router = express.Router();

router.post('/commands', (req: express.Request, res: express.Response) => {
    commandListController(req, res);
});

export default router;