var winston = require('winston');
var deepExtend = require('deep-extend');

const logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({'timestamp':true, 'colorize':true})
    ]
});



let load_config_file = () => {
    if(process.env.CONFIG_FILE){
        var filename = process.env.CONFIG_FILE;
        if(!(filename.startsWith('/') || filename.startsWith('./'))){
            filename = './'+filename;
        }
        if(!require('fs').existsSync(filename)){
            logger.info('Could not find config: ' + filename)
            return null;
        }
        try{
            var cfg = require(filename);
            logger.info('Loaded config file: ' + filename);
            return cfg;
        } catch(ex) {
            logger.info('Failed to load config file: ' + process.env.CONFIG_FILE)
            logger.info(ex)
        }
    }
};
var prod = load_config_file();
var development = require('./config/config.json')
var config = development;
if(prod){
    logger.info('Merging default and found configs.');
    logger.info('Default Config: \n'+JSON.stringify(config,null,2));
    logger.info('Found Config: \n'+JSON.stringify(prod,null,2));
    deepExtend(config,prod);
}

logger.info('Using config: \n' + JSON.stringify(config,null,2));
module.exports = config;
