import { Router } from 'express';
import search from './search';
import info from './info';

const router = Router();
router.use(search);
router.use(info);

export default router;