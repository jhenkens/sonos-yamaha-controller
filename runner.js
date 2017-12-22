#!/usr/bin/env node
'use strict';
var _ = require('underscore')
var sonos = require('sonos'),
    device = require('./device'),
    config = require('./config'),
    cron = require('node-cron'),
    datediff = require('date-diff'),
    YamahaAPI = require('yamaha-nodejs'),
    promiseRetry = require('promise-retry'),
    delayPromise = require('./delay-promise'),
    winston = require('winston')
    ;

const logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({'timestamp':true, 'colorize':true})
    ]
});

logger.level = process.env.LOG_LEVEL || config.log_level;



module.exports = {
  start: start
}

let state = {
    host: null,
    yamaha: null,
    last_playing: null,
    last_stopped: null,
    currently_playing: false,
    last_turned_yamaha_on: null,
    last_turned_yamaha_off: null,
    mutex: {
        host: false,
        on: false,
        off: false
    }
}
function start(){
    logger.info( 'Starting sonos-yamaha runner.')
    state.yamaha = new YamahaAPI(config.yamaha.ip)
    updateHost(() => checkIfPlaying(updateStatus));

    setTimeout(() => {
        cron.schedule(config.host_update_cron, () => {
            updateHost();
        });
        cron.schedule(config.check_cron, () => {
            checkIfPlaying(updateStatus);
        });
    },5000);
}

let updateHost = (callback) => {
    if(state.mutex.host) return;
    state.mutex.host = true;
    var nc = (a) => {
        if(callback) callback(a);
        state.mutex.host = false;
        logger.debug('Done updating host')
    }
    if(config.fallback_ip){
        logger.verbose('Using fallback IP for sonos...')
        updateHostByIp(config.fallback_ip, nc)
    } else{
        logger.verbose('Searching for sonos IP.')
        device.find(config.search_zone,
            (device) => {
                logger.verbose('Found sonos @ ' + device.ip)
                updateHostByIp(device.ip, nc)
            }
        );
    }
}

let updateHostByIp = (ip_address, callback) => {
    state.host = new sonos.Sonos(ip_address);
    if(callback) callback(state.host);
}

let checkIfPlaying = (callback) => {
    if(state.host){
        state.host.getCurrentState((err, track) => {
            if(track == 'playing'){
                logger.debug('Sonos is playing...')
                state.last_playing = new Date()
                state.currently_playing = true;
                if(callback) callback()
            } else if (track){
                logger.debug('Sonos is stopped...')
                state.last_stopped = new Date()
                state.currently_playing = false;
                if(callback) callback()
            }
        });
    }
}

let updateStatus = (playing) => {
    if(!state.currently_playing){
        turnYamahaOff();
    } else if (state.currently_playing){
        turnYamahaOn();
    }
}

let ensureYamahaSurround = (surround) => {
    return () => {
        logger.verbose('Enter: ensureYamahaSurround('+surround+')')
        return promiseRetry((r,n) => {
            if(n > 1 ) logger.warn("Failed to change yamaha surround, trying again... (" + n + ")");
            return state.yamaha.getSurround().then((s) => {
                if(s != surround){
                    return state.yamaha.setSurroundTo(surround);
                } else{
                    return Promise.resolve();
                }
            }).then(() =>
                state.yamaha.getSurround()
            ).then((s) => {
                if(s == surround){
                    return Promise.resolve();
                }
                return Promise.reject();
            }).catch(r);
        },
        {minTimeout: 1000, maxTimeout:1000});
    }
}

let ensureYamahaInput = (input) => {
    return () => {
        logger.verbose('Enter: ensureYamahaInput ('+input+')')
        return promiseRetry((r,n) => {
            if(n > 1 ) logger.warn("Failed to change yamaha input, trying again... (" + n + ")");
            return state.yamaha.getCurrentInput().then((s) => {
                if(s != input){
                    return state.yamaha.setMainInputTo(input);
                } else{
                    return Promise.resolve();
                }
            }).then(() =>
                state.yamaha.getCurrentInput()
            ).then((s) => {
                if(s == input){
                    return Promise.resolve();
                }
                return Promise.reject();
            }).catch(r);
        },
        {minTimeout: 1000, maxTimeout:1000});
    }
}

let ensureYamahaVolume = (vol) => {
    return () => {
        logger.verbose('Enter: ensureYamahaVolume ('+vol+')')
        return promiseRetry((r,n) => {
            if(n > 1 ) logger.warn("Failed to set Yamaha volume, trying again... (" + n + ")");

            return state.yamaha.getVolume().then((v) => {
                logger.debug('Yamaha current vol: ' + v)
                if(v != vol){
                    logger.debug('Setting vol to vol: ' + vol)
                    return state.yamaha.setVolumeTo(vol);
                } else{
                    return Promise.resolve();
                }
            }).then(() =>
                state.yamaha.getVolume()
            ).then((v) => {
                if(v == vol){
                    return Promise.resolve();
                }
                return Promise.reject();
            }).catch(r);
        },
        {minTimeout: 1000, maxTimeout:1000});
    }
};

let ensureYamahaOn = () => {
    logger.verbose('Enter: ensureYamahaOn')
    return promiseRetry((r,n) => {
        if(n > 1 ) logger.warn("Failed to power on Yamaha, trying again... (" + n + ")");

        return state.yamaha.isOn().then((on) => {
            if(!on){
                return state.yamaha.powerOn().
                then(delayPromise(config.yamaha.power_on_delay)).
                then(state.yamaha.setVolumeTo(config.sonos_vol));
            } else{
                return Promise.resolve();
            }
        }).then(() =>
            state.yamaha.isOn()
        ).then((on) => {
            if(on){
                return Promise.resolve();
            }
            return Promise.reject();
        }).catch(r);
    },
    {minTimeout: 1000, maxTimeout:1000});
}

let ensureYamahaOff = () => {
    logger.verbose('Enter: ensureYamahaOff')
    return promiseRetry((r,n) => {
        if(n > 1 ) logger.warn("Failed to turnoff Yamaha, trying again... (" + n + ")");

        return state.yamaha.isOn().then((on) => {
            if(on){
                return state.yamaha.powerOff().
                then(delayPromise(config.yamaha.change_delay));
            } else{
                return Promise.resolve();
            }
        }).then(() =>
            state.yamaha.isOn()
        ).then((on) => {
            if(!on){
                return Promise.resolve();
            }
            return Promise.reject();
        }).catch(r);
    },
    {minTimeout: 1000, maxTimeout:1000});
}

let turnYamahaOn = () =>{
    //Check if on, if not, set power and wait.
    //Check if input correct, if not, set input and wait
    //Check sound settings correct, if not, set settings
    if(state.mutex.on) return;
    if(state.last_turned_yamaha_on > state.last_stopped) return;

    state.mutex.on = true;
    logger.verbose("Attempting to turn sonos on...")

    ensureYamahaOn()
    .then(ensureYamahaInput(config.yamaha.sonos_input))
    .then(ensureYamahaSurround(config.yamaha.sonos_surround))
    .then(ensureYamahaVolume(config.yamaha.sonos_vol))
    .catch(() => logger.error("Failed to turn yamaha on properly for sonos"))
    .then(() => {
        state.last_turned_yamaha_on = new Date();
        logger.verbose('Done turning yamaha on')
        state.mutex.on = false;
    });
}

let turnYamahaOff = () =>{
    if(!state.last_playing){
        logger.debug("We've never played, so we can't turn off");
        return;
    }
    logger.silly('LastPlaying: ' + state.last_playing)
    logger.silly('LastTurnedOff: ' + state.last_turned_yamaha_off)
    var secondsSince
    var alreadyTurnedYamahaOff = (!!state.last_turned_yamaha_off) && (new datediff(state.last_playing, state.last_turned_yamaha_off).difference < 0);
    logger.silly('Have we already turned yamaha off?: ' + alreadyTurnedYamahaOff )
    if(alreadyTurnedYamahaOff) return;

    var minutes_since_last_playing = (new datediff(new Date(), state.last_playing)).minutes()
    logger.silly('How many minutes since last playing?: ' + minutes_since_last_playing )
    logger.silly('What are we waiting for?: ' + config.wait_before_poweroff_in_minutes )

    if( minutes_since_last_playing > config.wait_before_poweroff_in_minutes ){
        if(state.mutex.off) return;
        state.mutex.off = true;
        logger.verbose("Attempting to turn yamaha off...")

        ensureYamahaVolume(config.yamaha.defaul_vol)()
        .catch(() => logger.warn('failed to turn down yamaha before turning off'))
        .then(() => ensureYamahaOff())
        .catch(() => logger.warn('failed to turn off yamaha'))
        .then(() => {
            state.last_turned_yamaha_off = new Date();
            state.mutex.off = false;
            logger.verbose('Done turning yamaha off')
        })
    }
}
