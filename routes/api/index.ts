import { Router } from 'express';
import search from './search';
import info from './info';
import guildInfo from './guildInfo';
import pickup from './pickup';
import playedPickups from './playedPickups';
import playerSearch from './playerSearch';
import player from './player';

const router = Router();
router.use(search);
router.use(info);
router.use(guildInfo);
router.use(pickup);
router.use(playedPickups);
router.use(playerSearch);
router.use(player);

export default router;