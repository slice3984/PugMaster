import ConfigTool from './core/configTool';

(async () => {
    // Config check
    const configExists = await ConfigTool.doesConfigExist();
    if (!configExists) {
        console.error('Config file not found');
        await ConfigTool.generateConfig();
        console.log('Generated config.json, please edit this file and start the bot again.');
        process.exit(0);
    }

})();