import { Router } from 'express';
import search from './search';
import info from './info';
import guildInfo from './guildInfo';
import pickup from './pickup';
import playedPickups from './playedPickups';
import playerSearch from './playerSearch';
import player from './player';
import command from './command';
import commandInfo from './commandInfo';

const router = Router();
router.use(search);
router.use(info);
router.use(guildInfo);
router.use(pickup);
router.use(playedPickups);
router.use(playerSearch);
router.use(player);
router.use(command);
router.use(commandInfo);

export default router;