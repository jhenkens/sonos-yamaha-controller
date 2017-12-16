var extend = require('util')._extend

let load_config_file = () => {
    if(process.env.CONFIG_FILE){
        var filename = process.env.CONFIG_FILE;
        if(!(filename.startsWith('/') || filename.startsWith('./'))){
            filename = './'+filename;
        }
        if(!require('fs').existsSync(filename)){
            console.log('Could not find config: ' + filename)
            return null;
        }
        try{
            return require(filename);
        } catch(ex) {
            console.log('Failed to load config file: ' + process.env.CONFIG_FILE)
            console.log(ex)
        }
    }
};
var prod = load_config_file();
var development = require('./config/config.json')
var config = development;
if(prod){
    extend(config,prod);
}

module.exports = config;
