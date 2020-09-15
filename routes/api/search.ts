import express from 'express';
import searchController from '../../controllers/search';

const router = express.Router();

router.post('/search', (req: express.Request, res: express.Response) => {
    searchController(req, res);
});

export default router;